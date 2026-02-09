from flask import Flask, request, jsonify, Response
from requests import RequestException
from functools import wraps
from adapters import ADAPTERS
import fimbulwinter
import logging

app = Flask(__name__)
app.config['SECRET_KEY'] = fimbulwinter.environmentals('RAGNAROK_SECRET_KEY', 'supersecrettoken')
# set logging level
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s")

ALL_MATCHES = fimbulwinter.load_matches_from_io()

ALLOWED_ROOTS = ["clash-of-prodigies.github.io", "room.clashofprodigies.org", "localhost",]
AUTH_SERVICE_URL = fimbulwinter.environmentals('AUTH_SERVICE_URL', 'http://localhost:5001/introspect')
AUTH_PAGE_URL = "https://auth.clashofprodigies.org/"
standard_headers = {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
    "Vary": "Origin",
}

@app.after_request
def add_cors_headers(response: Response):
    origin = request.headers.get("Origin")
    if origin and fimbulwinter.is_allowed_origin(origin, ALLOWED_ROOTS):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers.update(standard_headers)
    return response

def protected(role: str='user'):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                identifiers = fimbulwinter.introspect_with_cerberus(AUTH_SERVICE_URL,request)
                user_role = identifiers.get('user_role', '')
                if role != user_role:
                    return jsonify({"error": "Insufficient permissions"}), 403
            except KeyError as ke:
                return jsonify({"error": f"Missing required header: {ke}"}), 401
            except ValueError as ve:
                return jsonify({"error": f"{ve}"}), 401
            except RequestException as re:
                app.logger.error(f"Error connecting to auth service: {re}")
                return jsonify({"error": "Authentication service unavailable"}), 503
            except Exception as e:
                app.logger.error(f"Unexpected error in protected decorator: {e}")
                return jsonify({"error": "Internal Server Error"}), 500
            else:
                kwargs.update(identifiers)
                return func(*args, **kwargs)
        return wrapper
    return decorator

@app.get('/matches/<match_id>')
def get_match(match_id):
    try:
        mode = request.args.get('mode', 'short')
        match_index = fimbulwinter.lookup_match_by_id(match_id=match_id, ALL_MATCHES=ALL_MATCHES)
        match = ALL_MATCHES[match_index]
        details = fimbulwinter.return_match_details_by_mode(match, mode)
    except ValueError as ve:
        return jsonify({"error": f"{ve}"}), 404
    except Exception as e:
        app.logger.error(f"Unexpected error in get_match: {e}")
        return jsonify({"error": "Something went wrong"}), 500
    else:
        return jsonify(details), 200

@app.get('/matches')
def get_all_matches():
    # Return all matches based on start time
    start_time = request.args.get('date', '')
    filtered_matches = fimbulwinter.filter_matches_by_date(ALL_MATCHES, start_time)
    return jsonify([match.to_dict() for match in filtered_matches]), 200

@app.put('/matches/<match_id>')
@protected('admin')
def add_match(match_id='', **kwargs):
    if not match_id:
        return jsonify({"error": "Match ID is required"}), 400
    try:
        data = request.get_json(silent=True)  or {}
        data['match_id'] = match_id
        match_type = data['match_type']
        if not match_type:
           raise ValueError("match_type is required")
        adapter = ADAPTERS.get(match_type, None) 
        if not adapter:
            return jsonify({"error": "Adapter not found"}), 500
        app.logger.debug(f"Adding match with data: {data} {request.data}")
        home, away = data.get('home_team', ''), data.get('away_team', '')
        if not home or not away: return jsonify({"error": "home_team and away_team are required"}), 400
        if fimbulwinter.lookup_match_by_id(match_id, ALL_MATCHES, silent=True) != -1:
            return jsonify({"error": "Match with this ID already exists"}), 400
        match = adapter(kwargs=data)
        ALL_MATCHES.append(match)
    except KeyError as ke:
        return jsonify({"error": f"Missing required field: {ke}"}), 400
    except ValueError as ve:
        return jsonify({"error": f"{ve}"}), 400
    except Exception as e:
        app.logger.error(f"Unexpected error in add_match: {e}")
        return jsonify({"error": "Something went wrong"}), 500
    else:
        user_name = kwargs.get('user_name', 'unknown')
        app.logger.info(f"Match {match_id} added successfully by {user_name}")
        return jsonify({"message": "Match added successfully"}), 201

@app.delete('/matches/<match_id>')
@protected('admin')
def remove_match(match_id='', user_name='', **kwargs):
    if not match_id:
        return jsonify({"error": "Match ID is required"}), 400
    try:
        i = fimbulwinter.lookup_match_by_id(match_id=match_id, ALL_MATCHES=ALL_MATCHES)
        del ALL_MATCHES[i]
    except ValueError as ve:
        return jsonify({"error": f"{ve}"}), 404
    except Exception as e:
        app.logger.error(f"Unexpected error in remove_match: {e}")
        return jsonify({"error": "Internal Server Error"}), 500
    else:
        app.logger.info(f"Match {match_id} removed successfully by {user_name}")
        return jsonify({"message": "Match removed successfully"}), 200

@app.patch('/matches/<match_id>')
@protected('admin')
def update_match_state(match_id='', **kwargs):
    if not match_id:
        return jsonify({"error": "Match ID is required"}), 400
    try:
        data = request.get_json() or {}
        data['match_id'] = match_id
        idx = fimbulwinter.lookup_match_by_id(match_id=match_id, ALL_MATCHES=ALL_MATCHES)
        ALL_MATCHES[idx].update_match(**data)
    except ValueError as ve:
        return jsonify({"error": f"{ve}"}), 400
    except Exception as e:
        app.logger.error(f"Unexpected error in update_match_state: {e}")
        return jsonify({"error": "Something went wrong"}), 501
    else:
        user_name = kwargs.get('user_name', 'unknown')
        app.logger.info(f"Match {match_id} updated successfully by {user_name}")
        return jsonify({"message": "Successfully changed state"}), 200

@app.delete('/matches')
@protected('admin')
def clear_all_matches(**kwargs):
   ALL_MATCHES.clear()
   user_name = kwargs.get('user_name', 'unknown')
   app.logger.info(f"All matches cleared by {user_name}")
   return jsonify({"message": "All matches cleared"}), 200

@app.post('/matches/<match_id>')
@protected('user')
def submit_answer(match_id='', **kwargs):
    if not match_id:
        return jsonify({"error": "Match ID is required"}), 400
    try:
        match_index = fimbulwinter.lookup_match_by_id(match_id=match_id, ALL_MATCHES=ALL_MATCHES)
        data = request.get_json() or {}
        ALL_MATCHES[match_index].store_answer(data=data, kwargs=kwargs or {})
    except ValueError as ve:    
        return jsonify({"error": f"{ve}"}), 400
    except Exception as e:
        app.logger.error(f"Unexpected error in submit_answer: {e}")
        return jsonify({"error": "Something went wrong"}), 400
    else:
        return jsonify({"message": "Answer submitted successfully"}), 200

if __name__ == '__main__':
    app.run(port=5000, debug=True)