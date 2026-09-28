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
    "account_query": [
        r"\baccount", r"\bbalance", r"\bhow much.*(in|have)", r"\bnet worth",
        r"\bwhat.*account", r"\blist.*account",
    ],
    "income_query": [
        r"\bincome", r"\bsalary", r"\bearn", r"\brental",
        r"\bfreelance", r"\bhow much.*(make|earn|get paid)",
        r"\bwhat.*(income|salary|earn)",
    ],
    "create_transaction": [
        r"\b(add|record|log|enter|save|create)\b.*\b(transaction|expense|spending|purchase|payment|income|salary|deposit|gain|spend)",
        r"\b(add|record|log|enter|create)\b.*\b(₹|rs\.?|rupees|dollars|\$)",
    ],
    "update_transaction": [
        r"\b(edit|change|update|modify|fix|correct)\b.*\b(transaction|expense|payment|income)",
        r"\b(edit|change|update|modify|fix|correct)\b.*\bamount",
    ],
    "delete_transaction": [
        r"\b(delete|remove|erase|cancel|undo)\b.*\b(transaction|expense|payment|income)",
        r"\bget rid of\b",
    ],
    "create_budget": [
        r"\b(add|set|create|make|update)\b.*\bbudget",
        r"\blimit.*spending\b",
    ],
    "create_goal": [
        r"\b(add|create|set|start|make)\b.*\bgoal",
        # Was a bare `\bsaving goal\b`, which also matched read-only
        # questions like "how is my saving goal progressing?" and so
        # misrouted them to multi_step. Requires an explicit request verb.
        r"\b(i want|i need|i'd like|help me)\b.*\bgoal",
    ],
    "create_category": [
        r"\b(add|create|make|new)\b.*\bcategor(y|ies)\b",
    ],
    "create_account": [
        r"\b(add|create|open|make|new)\b.*\baccount\b",
    ],
    "mark_bill_paid": [
        r"\b(mark|set)\b.*\bbill.*(paid|done)",
        r"\bpaid.*\bbill\b",
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
    return intent in (
        "spending_query", "budget_query", "goal_query", "bill_query",
        "account_query", "income_query",
        "create_transaction", "update_transaction", "delete_transaction",
        "create_budget", "create_goal", "create_category", "create_account",
        "mark_bill_paid",
    )
