CURRENCY_SYMBOLS = {
    "USD": "$", "EUR": "€", "GBP": "£", "INR": "₹", "JPY": "¥",
    "CAD": "C$", "AUD": "A$", "SGD": "S$", "CHF": "Fr", "CNY": "¥",
}


def get_currency_symbol(user) -> str:
    cur = (user.settings or {}).get("currency", "USD") if user else "USD"
    return CURRENCY_SYMBOLS.get(cur, "$")


def get_currency_code(user) -> str:
    return (user.settings or {}).get("currency", "USD") if user else "USD"
