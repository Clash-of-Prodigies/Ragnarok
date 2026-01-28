from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            auth_header = request.headers.get('Authorization')
            token = ''
            if auth_header and auth_header.lower().startswith('bearer '):
                token = auth_header.split(' ', 1)[1].strip()
            if not token and 'jwt' in request.cookies:
                token = request.cookies.get('jwt', '')
            if not token:
                raise ValueError("Missing token")
            if token == "supersecrettoken":
                sub = { "X-User-Id": "12345", "X-User-Role": "admin", "X-User-Name": "oracle", "X-User-Affiliation": "" }
            if token == "secrettoken1":
                sub = { "X-User-Id": "67890", "X-User-Role": "user", "X-User-Name": "hero", "X-User-Affiliation": "Alpha Team" }
            if token == "secrettoken2":
                sub = { "X-User-Id": "54321", "X-User-Role": "user", "X-User-Name": "villain", "X-User-Affiliation": "Beta Team" }
            if token == "secrettoken3":
                sub = { "X-User-Id": "98765", "X-User-Role": "user", "X-User-Name": "impostor", "X-User-Affiliation": "Gamma Team" }
            return f(*args, token_info=sub, **kwargs)
        except Exception as e:
            print(e)
            return jsonify({"message": "Something went wrong"}), 401, {"Cache-Control": "no-store"}
    return decorated

@app.route('/introspect', methods=['OPTIONS'])
@token_required
def introspect(token_info:dict = {}):
    headers = {
        "X-User-Id": token_info.get("X-User-Id", ""),
        "X-User-Role": token_info.get("X-User-Role", ""),
        "X-User-Name": token_info.get("X-User-Name", ""),
        "X-User-Affiliation": token_info.get("X-User-Affiliation", "")
    }
    return '', 204, headers
    

if __name__ == '__main__':
    # export environment variable
    # export admin token="supersecrettoken"
    import os
    os.environ['admin_token'] = 'supersecrettoken'
    os.environ['hero_token'] = 'secrettoken1'
    os.environ['villain_token'] = 'secrettoken2'
    os.environ['impostor_token'] = 'secrettoken3'
    print("Starting fake Cerberus auth service on port 5001...")
    print("Available tokens:")
    print(f" Admin token: {os.environ['admin_token']}")
    print(f" Hero token: {os.environ['hero_token']}")
    print(f" Villain token: {os.environ['villain_token']}")
    print(f" Impostor token: {os.environ['impostor_token']}")
    app.run(port=5001, debug=True)