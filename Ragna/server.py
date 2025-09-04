from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
import datetime

app = Flask(__name__)
CORS(app)

room_info = {
    "code": "#ACMINT",
    "home": {
        "name": "AC Milan",
        "logo": "Horse",
        "theme": "red",
        "angle": "-135deg",
    },
    "away": {
        "name": "Inter Milan",
        "logo": "Pulse",
        "theme": "indigo",
        "angle": "135deg",
    },
    "demoPlayers": [
        {
            "name": "Oracle (Me)",
            "avatar": "Jake",
            "team": "AC Milan",
            "ready": True,
            "roles": ["me"],
            "ping": 23,
        },
        {
            "name": "Tricky",
            "avatar": "Tricky",
            "team": "AC Milan",
            "ready": False,
            "roles": ["teammate"],
            "ping": 41,
        },
        {
            "name": "Robo",
            "avatar": "Robo",
            "team": "Inter Milan",
            "ready": False,
            "roles": ["opponent"],
            "ping": 55,
        },
        {
            "name": "Lucia",
            "avatar": "Lucia",
            "team": "Inter Milan",
            "ready": True,
            "roles": ["opponent"],
            "ping": 37,
        },
        {
            "name": "Fresh",
            "avatar": "Fresh",
            "team": "Spectators",
            "roles": ["spectator"],
            "ping": 60,
        },
    ],
}


@app.route("/lobby")
def enter_lobby():
    id = request.args.get('id', default='', type=str)
    if not id: return jsonify({})
    # 
    return jsonify()