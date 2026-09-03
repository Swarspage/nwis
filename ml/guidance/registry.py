"""
ml/guidance/registry.py

Rule registry for the NWIS Engineering Guidance Engine.
Provides access and indexing for engineering guidance rules.
"""

from typing import List, Optional, Dict
from .schema import GuidanceRuleDefinition
from .rules import RULES


class GuidanceRegistry:
    def __init__(self, rules: Optional[List[GuidanceRuleDefinition]] = None):
        self._rules: Dict[str, GuidanceRuleDefinition] = {}
        for r in rules or RULES:
            self._rules[r.rule_id] = r

    def get(self, rule_id: str) -> Optional[GuidanceRuleDefinition]:
        return self._rules.get(rule_id)

    def list_all(self) -> List[GuidanceRuleDefinition]:
        return list(self._rules.values())


registry = GuidanceRegistry()
