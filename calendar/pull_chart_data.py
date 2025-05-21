#!/usr/bin/env python3

import json
import os

import gspread

from datetime import datetime

def main():
    credentials = os.getenv('GDOC_CREDENTIALS')
    if not credentials:
        raise ValueError("GDOC_CREDENTIALS environment variable is not set")
    
    service_acct = json.loads(credentials)

    gc = gspread.service_account_from_dict(service_acct)

    sh = gc.open('published crosswords')
    records = sh.worksheet('all').get_all_records()

    for r in records:
        r['publish date'] = datetime.strptime(r['publish date'], '%m/%d/%Y').date().isoformat()
        r.pop('payment')
        r.pop('accepted')

    today = datetime.today()
    records = [r for r in records if datetime.fromisoformat(r['publish date']) <= today]

    with open('data.json', 'w') as f:
        json.dump(records, f, indent=4)

if __name__ == '__main__':
    main() 