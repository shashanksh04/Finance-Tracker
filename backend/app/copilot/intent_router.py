import re

INTENT_PATTERNS = {
    "spending_query": [
        r"\bspend", r"\bspent", r"\bexpense", r"\bcost", r"\bpaid",
        r"\bbought", r"\bpaying", r"\btransaction", r"\bcharge",
        r"\bhow much.* (on|for|in)", r"\btotal.* (spend|spent|cost)",
    ],
    "budget_query": [
        r"\bbudget", r"\bover budget", r"\bunder budget", r"\bremaining",
        r"\bleft.*budget", r"\bbudget.*left",
    ],
    "goal_query": [
        r"\bgoal", r"\btarget", r"\bsaving for", r"\bprogress",
        r"\bsave.*(for|toward)", r"\bplan.* (for|to)",
    ],
    "bill_query": [
        r"\bbill", r"\bdue", r"\bupcoming", r"\brecurring",
        r"\brenew", r"\bsubscription", r"\bpayment due",
    ],
    "compare_query": [
        r"\bcompare", r"\bvs\b", r"\bversus", r"\bdifference",
        r"\bchange.*(from|since|vs)", r"\bthan last",
    ],
}


def classify_intent(message: str) -> str:
    msg_lower = message.lower()
    matched_intents = set()

    for intent, patterns in INTENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, msg_lower):
                matched_intents.add(intent)
                break

    if "general_chat" in matched_intents:
        matched_intents.discard("general_chat")

    if len(matched_intents) >= 2:
        return "multi_step"
    elif len(matched_intents) == 1:
        return matched_intents.pop()
    else:
        return "general_chat"


def is_direct_answer_intent(intent: str) -> bool:
    return intent in ("spending_query", "budget_query", "goal_query", "bill_query")
