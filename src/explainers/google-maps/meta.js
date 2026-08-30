export default {
  id: 'google-maps',
  title: 'How Google Maps Finds Your Route',
  summary:
    'Every road on Earth is one edge in a graph, weighted not in miles but in seconds. Plain Dijkstra would search nine million junctions and take two seconds; the trick Google actually uses pre-builds a hierarchy of shortcuts over the map, so the query only ever climbs upward — and touches a few hundred junctions in a tenth of a millisecond.',
  accent: '#4285f4',
  // one-line teardown for the library card
  spec: '18M junctions · weighted in seconds · 280 nodes touched · 110 microseconds',
  // part names, so search finds this machine by what is inside it
  keywords:
    'dijkstra a-star shortest path graph contraction hierarchies shortcut arcs bidirectional search live traffic eta routing navigation',
  categories: ['communications', 'electronics'],
};
