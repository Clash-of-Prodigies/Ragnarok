"""
# Abstract base classes and data structures for match adapters.
## Match Flow

Admin hits endpoint to add a self. Match is created in 'upcoming' state.
Admin initializes the match, moving it to 'standby' state and fetching questions.
Admin starts the match, moving it to 'active' state and setting the start time.
- if the start time is in the future, the match will start at that time.
- if no start time is provided, the match starts immediately.
Frontend fetches the current question for users to answer.
- if the question's sentDate is in the future, an error is raised.
- if the question's time has expired, an error is raised.
Users submit answers to the current question.
- if the answer is submitted after the time limit, an error is raised.
Frontend asks to verify answers after the question time expires.
- correct answers are picked and recorded, scores are updated.
- the next question is prepared and its sentDate is set.
Frontend fetches the next current question.
"""

from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone
import threading

MatchState = {
    -99: "Invalid",
    -1: "Suspended",
    0: "Upcoming",
    1: "Standby",
    2: "Active",
    99: "Completed",
}

@dataclass(frozen=True)
class BaseQuestion:
    @dataclass(frozen=True)
    class Answer:
        player_info: dict[str, str] = field(default_factory=dict)
        time_received: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))
        base_points: float = 0.0
        bonus_points: float = 0.0

        def to_dict(self):
            temp_player_info = self.player_info.copy()
            temp_player_info.pop('user_id', None)
            return {
                "player_info": temp_player_info,
                "time_received": self.time_received.isoformat(),
            }

    question_id: str = ''
    text: str = ''
    answers: list[Answer] = field(default_factory=list)
    points: float = 1.0
    graded: bool = False
    sendDate: datetime|None = None
    duration: timedelta = timedelta(seconds=10)

    def from_dict_to_answer(self, ans:dict) -> Answer:
        player_info = ans.get('player_info', {})
        time_received = ans.get('time_received', datetime.now(tz=timezone.utc))
        if isinstance(time_received, str):
            time_received = datetime.fromisoformat(time_received)
        return self.Answer(player_info=player_info,
                           time_received=time_received,)

    def to_dict(self):
        sent_date = self.sendDate
        duration = self.duration
        sent_date_iso = ''
        duration_seconds = duration.total_seconds() if isinstance(duration, timedelta) else 10
        if sent_date and isinstance(sent_date, datetime):
            sent_date_iso = sent_date.isoformat()
        return {
            "id": self.question_id,
            "text": self.text,
            "sentDate": sent_date_iso,
            "duration": duration_seconds,
        }
    
    def pick_correct_answers(self) -> list[Answer]:
        # Placeholder: In real implementation, determine correct answers
        raise NotImplementedError("pick_correct_answers must be implemented in subclasses")
    
    
    
class BaseMatch:
    def __init__(self, match_id:str, home_team:str, away_team:str, home_score=0.0, away_score=0.0,
                rounds=1, state=0, scorers:list|None=None,
                qpr=5, tpq:list[float]|None=None, ppq:float=1,
                start_time=None, end_time=None, cooldown_duration=10):
        self.match_id: str = match_id
        self.home_team: str = home_team
        self.away_team:str = away_team
        self.home_score:float = home_score
        self.away_score:float = away_score
        self.rounds:int = rounds
        self.state:int = state
        self.scorers:list[BaseQuestion.Answer] = [] if scorers is None else scorers
        self.questions:tuple[list[BaseQuestion], list[BaseQuestion]] = ([],[]) # [unused, used]
        self.current_question:BaseQuestion | None = None
        self.current_answers: dict[str, BaseQuestion.Answer] = {}
        self.qpr:int = qpr # questions per round
        self.tpq:list[float] = [] if tpq is None else tpq  # time per question per round
        self.ppq:float = ppq  # points per question
        self.start_time:datetime | None = start_time
        self.end_time:datetime | None = end_time
        self.cooldown_duration:timedelta = timedelta(seconds=cooldown_duration)  # in seconds
        self._verify_lock = threading.Lock()

        if not self.match_id:
            raise ValueError("Match ID cannot be empty")
        if not self.home_team or not self.away_team:
            raise ValueError("Both teams must be defined")
        if self.rounds <= 0:
            raise ValueError("Rounds must be a positive integer")
        if self.qpr <= 0:
            raise ValueError("Questions per round must be a positive integer")
        if not self.tpq or len(self.tpq) < self.rounds:
            raise ValueError("Time per question list must have at least as many entries as rounds")
    
    def to_dict(self):
        return {
            "match_id": self.match_id,
            "home_team": self.home_team,
            "away_team": self.away_team,
            "home_score": self.home_score,
            "away_score": self.away_score,
            "rounds": self.rounds,
            "state": self.state,
            "scorers": [scorer.to_dict() for scorer in self.scorers],
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "progress": f"{len(self.questions[1])}/{self.rounds * self.qpr}",
        }
    
    def _increment_home_score(self, points:float=0.0):
        if self.state != 2:
            raise ValueError("Match is not active")
        self.home_score += points

    def _increment_away_score(self, points:float=0.0):
        if self.state != 2:
            raise ValueError("Match is not active")
        self.away_score += points

    def _decrement_home_score(self, points:float=0.0):
        if self.state != 2:
            raise ValueError("Match is not active")
        if self.home_score < 0: raise ValueError("Score cannot be negative")
        self.home_score = max(0, self.home_score - points)

    def _decrement_away_score(self, points:float=0.0):
        if self.state != 2:
            raise ValueError("Match is not active")
        if self.away_score < 0: raise ValueError("Score cannot be negative")
        self.away_score = max(0, self.away_score - points)

    def _add_bonus_points_to_home(self, score_info:BaseQuestion.Answer, points:float=0.0):
        if self.state != 2:
            raise ValueError("Match is not active")
        score_info = replace(score_info, bonus_points=score_info.bonus_points + points)
        self.home_score += points
        return score_info
    
    def _add_bonus_points_to_away(self, score_info:BaseQuestion.Answer, points:float=0.0):
        if self.state != 2:
            raise ValueError("Match is not active")
        score_info = replace(score_info, bonus_points=score_info.bonus_points + points)
        self.away_score += points
        return score_info
    
    def _home_team_scores(self, score_info:BaseQuestion.Answer, points=0.0):
        if self.state != 2:
            raise ValueError("Match is not active")
        self.scorers.append(score_info)
        self._increment_home_score(points)
        score_info = self._add_bonus_points_to_home(score_info)
        return score_info
    
    def _away_team_scores(self, score_info:BaseQuestion.Answer, points=0.0):
        if self.state != 2:
            raise ValueError("Match is not active")
        self.scorers.append(score_info)
        self._increment_away_score(points)
        score_info = self._add_bonus_points_to_away(score_info)
        return score_info
    
    def _fetch_questions_from_bank(self):
        if self.state != 1:
            raise ValueError("Match must be in 'standby' to fetch questions")
        # Placeholder: In real implementation, fetch from a question bank
        questions:list[BaseQuestion] = self.questions[0] # reference to unused questions, not a copy
        for tpqpr in self.tpq: # time per question per round
            for i in range(self.rounds * self.qpr):
                question = BaseQuestion(
                    question_id = f"q{i+1}", text = f"Sample question {i+1}?", points = 1,
                    sendDate=None, duration = timedelta(seconds=tpqpr)
                )
                questions.append(question)

    def _initialize_match(self):
        # Initialize or reset the match to its starting state
        # Switch match to 'standby'
        self.state = 1  # Standby
        self.home_score = self.away_score = 0
        self.scorers = []
        self.current_question = None
        self.current_answers = {}
        self.questions = ([], [])
        self._fetch_questions_from_bank()
        start_time = self.start_time.isoformat() if self.start_time else ''
        return {'success': True, 'data': {'start_time': start_time} }
    
    def _start_match(self):
        if not self.start_time:
            self.start_time = datetime.now(tz=timezone.utc) + self.cooldown_duration
        else:
            if datetime.now(tz=timezone.utc) < self.start_time:
                raise ValueError(f"Cannot start before schedule. Try again at {self.start_time.isoformat()}")
            self.state = 2  # Active
        if not self.home_team or not self.away_team:
            raise ValueError("Both teams must be defined to start the match")
        self._prep_current_question()
        return {'success': True, 'data': {'start_time': self.start_time.isoformat()} }
    
    def _get_current_question(self):
        if self.state != 2:
            raise ValueError("Match is not active")
        if not self.current_question:
            raise ValueError("No current question available")
        sentDate = self.current_question.sendDate
        if isinstance(sentDate, datetime):
            if sentDate > datetime.now(tz=timezone.utc):
                sentDate_iso = sentDate.isoformat()
                raise ValueError(f"Current question is not ready. Try again at {sentDate_iso}")
            duration = self.current_question.duration
            if isinstance(duration, timedelta):
                if datetime.now(tz=timezone.utc) > (sentDate + duration):
                    raise ValueError("Current question time has expired")
        else:
            raise ValueError("Current question has no sent time set yet")
        return self.current_question
    
    def get_current_question(self):
        question = self._get_current_question()
        return question.to_dict()
    
    def _prep_current_question(self, sentDate:datetime|None=None):
        if self.state != 2:
            raise ValueError("Match is not active")
        if not self.questions[0]:
            raise ValueError("No more questions available")
        if self.current_question is not None:
            self.questions[1].append(self.current_question)
        unused_questions = self.questions[0] # reference to unused questions, not a copy
        self.current_question = unused_questions.pop() if unused_questions else None
        if self.current_question:
            self.current_question = replace(self.current_question, sendDate=sentDate or datetime.now(tz=timezone.utc) + self.cooldown_duration)
        else:
            raise ValueError("No more questions available")
    
    def _store_answer(self, answer:BaseQuestion.Answer):
        if self.state != 2:
            raise ValueError("Match is not active")
        affiliation = answer.player_info.get('user_affiliation', '')
        if affiliation != self.home_team and affiliation != self.away_team:
            raise ValueError("Player does not belong to either team")
        if not self.current_question:
            raise ValueError("No current question to submit answer for")
        sentDate = self.current_question.sendDate
        if sentDate is None:
            raise ValueError("Current question has no sent time sent yet")
        duration = self.current_question.duration
        if isinstance(sentDate, datetime) and isinstance(duration, timedelta):
            if datetime.now(tz=timezone.utc) < sentDate:
                raise ValueError(f"Cannot submit answer yet. Try again at {sentDate.isoformat()}")
            delta = (answer.time_received - sentDate)
            if delta > duration:
                raise ValueError("Answer submitted after time limit")
            self.current_answers[answer.player_info['user_id']] = answer # store latest answer only
            return answer.to_dict()
        raise ValueError("Could not store answer")
    
    def store_answer(self, kwargs:dict, data:dict={}):
        if self.state != 2:
            raise ValueError("Match is not active")
        if not self.current_question:
            raise ValueError("No current question to submit answer for")
        ans = {**data, 'player_info': kwargs}
        answer = self.current_question.from_dict_to_answer(ans)
        return self._store_answer(answer)
    
    def _get_correct_answers(self, question:BaseQuestion|None = None) -> list[BaseQuestion.Answer]:
        if self.state != 2:
            raise ValueError("Match is not active")
        if question is None:
            if not self.current_question:
                raise ValueError("No current question to pick answers for")
            question = self.current_question
        sentDate = question.sendDate
        if sentDate is None:
            raise ValueError("Current question has no sent time sent yet")
        duration = question.duration
        if isinstance(sentDate, datetime) and isinstance(duration, timedelta):
            if datetime.now(timezone.utc) < (sentDate + duration):
                raise ValueError(f"Cannot verify yet. Try again at {(sentDate + duration).isoformat()}")
            correct_answers = question.pick_correct_answers()
            return correct_answers
        else:
            raise ValueError("Invalid time constraints for current question")
    
    def _record_correct_answers(self, correct_answers:list[BaseQuestion.Answer], points=0.0):
        if self.state != 2:
            raise ValueError("Match is not active")
        question = self.current_question
        if not question:
            raise ValueError("No current question to record answers for")
        for i in range(len(correct_answers)):
            ans = correct_answers[i]
            affiliation = ans.player_info.get('user_affiliation', '')
            if affiliation == self.home_team:
                correct_answers[i] = self._home_team_scores(ans, points or question.points)
            elif affiliation == self.away_team:
                correct_answers[i] = self._away_team_scores(ans, points or question.points)
            else:
                continue
        self._prep_current_question()
        self.current_answers = {}


    def verify_answers(self, id: str = ''):
        if self.state != 2:
            raise ValueError("Match is not active")
        if not id:
            if not self.current_question:
                raise ValueError("No current question to verify")
            id = self.current_question.question_id

        with self._verify_lock:
            # 1) If it's already in used questions, return cached (no recompute, no scoring)
            used = self.questions[1]
            used_q = next((q for q in used if q.question_id == id), None)
            if used_q is not None:
                if not used_q.graded:
                    raise ValueError("Question exists but has not been verified yet")
                return [ans.to_dict() for ans in used_q.answers]

            # 2) Otherwise it must be the current question
            if not self.current_question:
                raise ValueError("No current question to verify")
            if self.current_question.question_id != id:
                raise ValueError("Question id does not match current question and was not found in used questions")

            q = self.current_question

            # 3) If already graded (idempotent), return cached
            if q.graded:
                return [ans.to_dict() for ans in q.answers]

            # 4) Time gate
            sentDate = q.sendDate
            duration = q.duration
            if sentDate is None or not isinstance(sentDate, datetime):
                raise ValueError("Current question has no sent time set yet")
            if not isinstance(duration, timedelta):
                raise ValueError("Invalid duration")

            now = datetime.now(tz=timezone.utc)
            if now < (sentDate + duration):
                raise ValueError(f"Cannot verify yet. Try again at {(sentDate + duration).isoformat()}")

            # 5) Grade using all submitted answers (snapshot)
            # IMPORTANT: MultiChoiceQuestion.pick_correct_answers reads self.answers
            all_answers = list(self.current_answers.values())
            q_with_all = replace(q, answers=all_answers)

            correct_answers = q_with_all.pick_correct_answers()

            # Cache results on the question and mark graded
            q_graded = replace(q_with_all, answers=list(correct_answers), graded=True)
            self.current_question = q_graded

            # 6) Score + advance exactly once
            self._record_correct_answers(list(correct_answers), points=q_graded.points)

            # If your override already clears these, keep it consistent.
            # BaseMatch._record_correct_answers currently also clears and advances.

            return [ans.to_dict() for ans in correct_answers]

    
    def _pause_match(self, recess:float = -1):
        if self.state != 2:
            raise ValueError("Match is not active")
        self.state = 1  # Standby
        recess_duration = timedelta(seconds=recess)
        if recess <= 0:
            return
        self.start_time = datetime.now(tz=timezone.utc) + recess_duration

    def _update_match(self, **kwargs):
        for key, value in kwargs.items():
            if hasattr(self, key):
                if key == 'state':
                    continue  # state changes should go through change_match_state
                setattr(self, key, value)
    
    def update_match(self, **kwargs):
        if 'state' in kwargs:
            new_state = kwargs.pop('state', self.state)
            self._change_match_state(new_state)
        else:
            if self.state != -1:
                raise ValueError("Match must be suspended to update other attributes")
        self._update_match(**kwargs)
    
    def _suspend_match(self):
        if self.state not in [1, 2]:
            raise ValueError("Match is neither active nor standby")
        self.state = -1  # Suspended

    def _cancel_match(self):
        if self.state not in [-1, 0, 1]:
            raise ValueError("Match cannot be cancelled in its current state")
        self.state = -99  # Invalid / Cancelled

    def _end_match(self):
        if self.state != 2:
            raise ValueError("Match is not in progress")
        if not self.end_time: self.end_time = datetime.now(tz=timezone.utc)
        self.state = 99  # Completed
    
    def _restart_match(self):
        if self.state != 2:
            raise ValueError("Match is not active and cannot be restarted")
        self.home_score = self.away_score = 0
        self.scorers = []
        self.questions = ([], [])
        self._fetch_questions_from_bank()
        self._start_match()

    def _reset_match(self):
        self.home_score = self.away_score = 0
        self.scorers = []
        self.questions = ([], [])
        self.state = 0  # Upcoming
        self.start_time = None
        self.end_time = None
    
    def _change_match_state(self, new_state:int):
        if not isinstance(new_state, int):
            raise ValueError("State must be an integer")
        if new_state == self.state:
            raise ValueError("Match is already in the desired state")
        if new_state == 0:
            # not allowed to revert from 'active' or 'completed' to 'upcoming'
            if self.state in [2, 99]:
                raise ValueError("Match is already started or completed")
            self._reset_match()
        elif new_state == 1:
            if self.state == 0 or self.state == -1:
                # from upcoming or suspended to standby
                self._initialize_match()
            elif self.state == 2:
                # from active to standby
                self._pause_match()
            else:
                raise ValueError("Match must be 'upcoming' or 'active' to change to 'standby'")
        elif new_state == 2:
            if self.state == 1 or self.state == -1:
                # from standby or suspended to active
                self._start_match()
            else:
                raise ValueError("Match must be 'standby' or 'suspended' to start")
        elif new_state == 99:
            if self.state == 2 or self.state == -1:
                # from active or suspended to completed
                self._end_match()
            else:
                raise ValueError("Match must be 'active' or 'suspended' to complete")
        elif new_state == -1:
            if self.state == 2 or self.state == 1:
                # from active to suspended
                self._suspend_match()
            else:
                raise ValueError("Match must be 'active' or 'standby' to suspend")
        elif new_state == -99:
            if self.state == -1 or self.state == 0 or self.state == 1:
                # from suspended, upcoming, or standby to cancelled
                self._cancel_match()
            else:
                raise ValueError("Match must be 'suspended', 'upcoming', or 'standby' to cancel")
        else:
            raise ValueError("Invalid state value")

class BaseTeamMatch(BaseMatch):
    def __init__(self, match_id, home_team, away_team, home_score=0.0, away_score=0.0,
                rounds=1, state=0, scorers=None,
                qpr=5, tpq=None,
                start_time=0, end_time=0,
                home_roster=None, away_roster=None):
        super().__init__(match_id=match_id, home_team=home_team, away_team=away_team,
                        home_score=home_score, away_score=away_score,
                        rounds=rounds, state=state, scorers=[] if scorers is None else scorers,
                        qpr=qpr, tpq=[] if tpq is None else tpq,
                        start_time=start_time, end_time=end_time,)
        self.home_roster:set[str] = set() if home_roster is None else home_roster
        self.away_roster:set[str] = set() if away_roster is None else away_roster

        if not self.home_roster or not self.away_roster:
            raise ValueError("Both teams must have rosters defined")

    def _add_to_home_roster(self, players:list[str]):
        self.home_roster.update(players)

    def _add_to_away_roster(self, players:list[str]):
        self.away_roster.update(players)
    
    def _away_team_scores(self, score_info: BaseQuestion.Answer, points=0.0):
        super()._away_team_scores(score_info, points)
    
    def _home_team_scores(self, score_info: BaseQuestion.Answer, points=0.0):
        super()._home_team_scores(score_info, points)

    def _store_answer(self, answer: BaseQuestion.Answer):
        if self.state != 2:
            raise ValueError("Match is not active")
        name = answer.player_info.get('user_name', '')
        if name not in self.home_roster and name not in self.away_roster:
            raise ValueError("Player does not belong to either team")
        super()._store_answer(answer)
    
    def _record_correct_answers(self, correct_answers:list[BaseQuestion.Answer], points=0.0):
        if self.state != 2:
            raise ValueError("Match is not active")
        if not correct_answers:
            return
        question = self._get_current_question()
        for ans in correct_answers:
            affiliation = ans.player_info.get('user_affiliation', '')
            if affiliation == self.home_team:
                self._home_team_scores(ans, points or question.points)
            elif affiliation == self.away_team:
                self._away_team_scores(ans, points or question.points)
            else:
                continue
        self._prep_current_question()
        self.current_answers = {}

    def _start_match(self):
        if not self.home_roster or not self.away_roster:
            raise ValueError("Both teams must have rosters to start the match")
        super()._start_match()

class BaseIndividualMatch(BaseMatch):
    def __init__(self, match_id, home_team, away_team, home_score=0.0, away_score=0.0,
                rounds=1, state=0, scorers=None,
                qpr=5, tpq=None, ppq=5,
                start_time=0, end_time=0,):
        super().__init__(match_id=match_id, home_team=home_team, away_team=away_team,
                        home_score=home_score, away_score=away_score,
                        rounds=rounds, state=state, scorers=[] if scorers is None else scorers,
                        qpr=qpr, tpq=[] if tpq is None else tpq, ppq=ppq,
                        start_time=start_time, end_time=end_time,)