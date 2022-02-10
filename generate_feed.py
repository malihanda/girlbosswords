import yaml

from datetime import datetime
from urllib.parse import urljoin

from dateutil import tz
from feedgen.feed import FeedGenerator

def main():
    home = 'https://www.girlbosswords.com/'
    fg = FeedGenerator()
    fg.id(home)
    fg.title('girlbosswords')
    fg.link(href=home, rel='alternate')
    fg.link(href=urljoin(home, 'atom.xml'), rel='self')
    fg.logo('data/favicon.png')
    fg.author(name='malaika handa')

    with open('entries.yaml') as f:
        entries = yaml.safe_load(f)

    for e in reversed(entries):
        if e['girlboss']:
            link = (e['link'] if e['link'].startswith('http')
                                else urljoin(home, e['link']))
            fe = fg.add_entry()
            fe.id(link)
            fe.title(e['title'])
            date = e.get('date', datetime(1970,1,1))
            fe.updated(date.astimezone(tz.tzlocal()))
            fe.content('Solve this puzzle at {}'.format(link))
            fe.link(href=link, rel='alternate')

    fg.atom_file('atom.xml', pretty=True) 

if __name__ == '__main__':
    main()
