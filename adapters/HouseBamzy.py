"""
# HouseBamzy.py
These is the implementation for the matches in House of Bamzy
"""

from .abstract import BaseIndividualMatch, BaseQuestion
from dataclasses import dataclass, field
from collections.abc import Sequence
from datetime import datetime, timedelta
from logging import Logger

@dataclass(frozen=True)
class MultiChoiceQuestion(BaseQuestion):
    @dataclass(frozen=True)
    class Answer(BaseQuestion.Answer):
        selected_option: int = -1
    
    options: list[str] = field(default_factory=list)
    correct_option: int = -99
    answers: list[Answer] = field(default_factory=list)

    def from_dict_to_answer(self, ans: dict) -> Answer:
        player_info = ans.get('player_info', {})
        selected_option = ans.get('selected_option', -1)
        return self.Answer(player_info=player_info, selected_option=selected_option,)
    
    def to_dict(self):
        question_details = super().to_dict()
        question_details.update({ "options": self.options, })
        return question_details
    
    def pick_correct_answers(self):
        correct_answers = [ans for ans in self.answers if ans.selected_option == self.correct_option]
        return correct_answers

class HouseBamzyMatch(BaseIndividualMatch):
    def __init__(self, logger:Logger, kwargs:dict):
        match_id = kwargs.get('match_id', '')
        comp_info = kwargs.get('comp_info', {})
        home_team = kwargs.get('home_team', '')
        away_team = kwargs.get('away_team', '')
        home_score = kwargs.get('home_score', 0)
        away_score = kwargs.get('away_score', 0)
        rounds = kwargs.get('rounds', 2)
        state = kwargs.get('state', 0)
        scorers = kwargs.get('scorers', [])
        tpq = kwargs.get('tpq', [10.0, 20.0])  # time per question per round
        ppq = kwargs.get('ppq', 5.0)  # points per question
        start_time = kwargs.get('start_date', None)
        end_time = kwargs.get('end_date', None)
        super().__init__(match_id=match_id, comp_info=comp_info, home_team=home_team, away_team=away_team,
                home_score=home_score, away_score=away_score,
                rounds=rounds, state=state, scorers=scorers, tpq=tpq, ppq=ppq,
                start_time=start_time, end_time=end_time,
                logger=logger)
        self.RecessDuration:float = 120.0  # in seconds
        self.PPW:float = 50.0 # Points Per Win
        self.W2S:float = 5.0 # Within 2 Seconds Bonus
    
    def _pause_match(self):
        return super()._pause_match(recess=self.RecessDuration)
    
    def _add_bonus_points(self, score_info:MultiChoiceQuestion.Answer, points:float=0.0):
        # according to Bamzy's specs, answers received within 2 seconds get 5 bonus points
        if not score_info:
            return points
        question = self.current_question
        if not question:
            return points
        question_sent_date = question.sendDate
        if isinstance(question_sent_date, datetime):
            time_taken = (score_info.time_received - question_sent_date).total_seconds()
            if time_taken <= 2:
                points += self.W2S
        return points
    
    def _add_bonus_points_to_away(self, score_info:MultiChoiceQuestion.Answer, points:float=0.0):
        points = self._add_bonus_points(score_info, points)
        super()._add_bonus_points_to_away(score_info, points)
    
    def _add_bonus_points_to_home(self, score_info:MultiChoiceQuestion.Answer, points:float=0.0):
        points = self._add_bonus_points(score_info, points)
        super()._add_bonus_points_to_home(score_info, points)
     
    def _record_correct_answers(self, correct_answers:list[MultiChoiceQuestion.Answer], points=0.0) -> None:
        if self.state != 2:
            raise ValueError("Match is not active")
        question = self.current_question
        if not question:
            raise ValueError("No current question to record answers for")
        temp_scorers = self.scorers.copy()[::-1]  # Reverse copy for latest first
        consecutive_goals = 1
        for scorer_info in correct_answers:
            for scorer in temp_scorers:
                name = scorer.player_info.get('user_name', '')
                if name == scorer_info.player_info.get('user_name', '') and name != '':
                    consecutive_goals += 1
                else:
                    break
            affiliation = scorer_info.player_info.get('user_affiliation', '')
            if affiliation == self.home_team:
                if consecutive_goals < 3:
                    points = points or question.points
                elif consecutive_goals == 3:
                    points = (points or question.points) * 2
                elif consecutive_goals >= 4:
                    points = (points or question.points) * 3
                    consecutive_goals = 1  # reset after hat-trick
                self._home_team_scores(scorer_info, points)
            elif affiliation == self.away_team:
                if consecutive_goals < 3:
                    points = points or question.points
                elif consecutive_goals == 3:
                    points = (points or question.points) * 2
                elif consecutive_goals >= 4:
                    points = (points or question.points) * 3
                    consecutive_goals = 1  # reset after hat-trick
                self._away_team_scores(scorer_info, points or question.points)
            else:
                continue
        self._prep_current_question()
        self.current_answers = {}

    def _get_correct_answers(self, question:BaseQuestion|None = None) -> Sequence[BaseQuestion.Answer]:
        correct_answers = super()._get_correct_answers(question=question)
        answer_to_player: dict[str, BaseQuestion.Answer] = {}
        for ans in correct_answers:
            player_name = ans.player_info.get('user_id', '')
            if player_name not in answer_to_player:
                answer_to_player[player_name] = ans
            else:
                existing_ans = answer_to_player[player_name]
                if ans.time_received > existing_ans.time_received: # keep latest
                    answer_to_player[player_name] = ans
        sorted_correct = sorted(answer_to_player.values(), key=lambda a: a.time_received)
        ans = sorted_correct[0] if sorted_correct else None # First correct answer only
        return [ans] if ans else []

    def _fetch_questions_from_bank(self):
        if self.state != 1:
            raise ValueError("Match must be in 'standby' to fetch questions")
        # Placeholder: In real implementation, fetch from a question bank
        questions = self.questions[0] # reference to unused questions, not a copy
        for i, tpqpr in enumerate(self.tpq): # time per question per round
            for j in range(self.rounds * self.qpr):
                question = MultiChoiceQuestion(
                    question_id = f"q-{i+1}-{j+1}", text = f"Sample question {i+1}?", points = 1,
                    options = [f"Option {j+1}" for j in range(4)], correct_option = 0,
                    sendDate=None, duration=timedelta(seconds=tpqpr)
                )
                questions.append(question)
