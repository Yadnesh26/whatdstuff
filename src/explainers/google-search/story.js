export default {
  angle:
    'When you press Enter, Google does not search the internet. It searches a copy it made in advance, filed like the index at the back of a book, and cut into slices so a thousand machines each check one sliver at the same time.',
  stat: 'One search touched about 1,000 computers and came back in about 0.2 seconds (Google, 2009), against an index of hundreds of billions of pages and more than 100 million gigabytes.',
  button: 'The searching happened before you asked.',
  who: 'Anyone who types a question into Google twenty times a day and assumes it is somehow reading the whole internet each time.',
  beats: [
    {
      idea: 'You ask, and a fifth of a second later ten answers arrive, picked from hundreds of billions of pages. Nothing could read that many in time, so Google does not.',
      visuals: [
        'a screen with "how do bees make honey" typed into a search bar',
        'result rows landing on that screen after the question flies off and back',
        'the whole system on one table: a web of pages, an index wall, a row of server racks',
      ],
    },
    {
      idea: 'Crawlers walk the web ahead of time, link to link, copying every page they land on.',
      visuals: [
        'page cards floating in a web, joined by link threads',
        'three spider-bots walking along the threads, pausing on each page',
        'the visited page flashing and a copy of it flying off toward the index',
      ],
    },
    {
      idea: 'Each copy is broken into its words, and the page number is written onto each word\'s line, like the index at the back of a book.',
      visuals: [
        'a wall of seven word lines, each holding a sorted row of page-number tiles',
        'the copy of page 18 arriving and splitting into five word chips',
        'tile 18 appearing in its sorted slot on the bees, honey, hive, make and nectar lines',
      ],
    },
    {
      idea: 'A question is answered by comparing two short lists of numbers, without opening a single page.',
      visuals: [
        'the bees and honey lines lit, every other line dimmed',
        'a scan bar running along both lines at once',
        'the four page numbers on both lines (7, 18, 31, 44) lighting up as matches',
      ],
    },
    {
      idea: 'The index is cut by page number into slices on separate machines; every slice is searched at once and the replies are merged.',
      visuals: [
        'five server racks, each tagged with its slice of page numbers',
        'the question splitting at a front server and reaching all five racks at the same moment',
        'racks with a match sending back a numbered chip, the 20-29 rack sending nothing',
      ],
    },
    {
      idea: 'To order the matches, every link counts as a vote, and a vote from a heavily linked page counts more (PageRank).',
      visuals: [
        'the same web of pages, each card sized by its PageRank computed from the drawn links',
        'vote particles flowing along links, bigger from bigger pages',
        'the hub page passing a heavy vote to page 18',
      ],
    },
    {
      idea: 'Links are one clue among hundreds; they add into one score and the results are sorted by it.',
      visuals: [
        'the four results on the screen, each with a stacked score bar of coloured clues',
        'the rows sliding from page-number order into score order',
      ],
    },
  ],
};
