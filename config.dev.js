module.exports = {
  cmd_prefix: '!',
  db_path: './userinfo.db',
  allowed_domains: ['ucla'],
  affiliation_map: {
    student: 's',
    alumni: 'a',
    faculty: 'f',
    other: 'o',
  },
  discord: {
    server_id: '842102423345823765',
    gen_code_length: 6,
    guest_role_name: 'Guest',
    verified_role_name: 'Verified',
    mod_role_name: 'Moderator',
    alumni_role_name: 'Alumni',
    student_role_name: 'Student',
    faculty_role_name: 'UCLA Faculty and Staff',
  },
  ses: {
    region: 'us-west-1',
    sender: 'acm@ucla.edu',
  },
  default_msgs: {
    welcome: `
Welcome to the official **ACM at UCLA** Discord community!

To keep the server a safe place for everyone,  please verify yourself using your university (.edu) email address. Also, please let us know your affiliation with UCLA (student/alumni/other). Use "other" if you're not a UCLA student. If you are a UCLA student, please make sure to use your UCLA email address. We recommend using **\`@g.ucla.edu\`** over **\`@ucla.edu\`** for faster verification.

**By verifying, you agree to the rules and guidelines posted in #:information_source:server-info**
To obtain your verification code, reply to this message with the following command:
\`\`\`MD
/iam <affiliation> <name> <ucla_email>
\`\`\`
`,
  },
  majors_list: [
    'aerospace engineering',
    'african american studies',
    'african and middle eastern studies',
    'african studies',
    'american indian studies',
    'american literature and culture',
    'ancient near east and egyptology',
    'anthropology',
    'applied economics',
    'applied linguistics',
    'applied mathematics',
    'applied statistics',
    'arabic',
    'archaeology',
    'architectural studies',
    'architecture',
    'architecture and urban design',
    'art',
    'art history',
    'asian american studies',
    'asian humanities',
    'asian languages and cultures',
    'asian languages and linguistics',
    'asian studies',
    'asian religions',
    'atmospheric and oceanic sciences',
    'atmospheric and oceanic sciences/mathematics',
    'astronomy and astrophysics',
    'astrophysics',
    'biochemistry',
    'biochemistry, molecular and structural biology',
    'bioengineering',
    'bioinformatics',
    'biology',
    'biomathematics',
    'biophysics',
    'biostatistics',
    'business administration',
    'business analytics',
    'business economics',
    'central and east european languages and cultures',
    'chemical engineering',
    'chemistry',
    'chemistry/materials science',
    'chicana and chicano studies',
    'chinese',
    'choreographic inquiry',
    'classics',
    'classical civilization',
    'climate science',
    'clinical research',
    'civil engineering',
    'cognitive science',
    'communication',
    'community health sciences',
    'comparative literature',
    'computational and systems biology',
    'computer engineering',
    'computer science',
    'computer science and engineering',
    'computer engineering',
    'conservation of archaeological and ethnographic materials',
    'conservation of material culture',
    'culture and performance',
    'dance',
    'data theory',
    'dental surgery',
    'design | media arts',
    'earth and environmental science',
    'east asian studies',
    'ecology, behavior, and evolution',
    'economics',
    'education',
    'education and social transformation',
    'educational administration joint edd with uci',
    'electrical and computer engineering',
    'electrical engineering',
    'engineering geology',
    'engineering mengr, engr',
    'engineering — aerospace',
    'engineering — computer networking',
    'engineering — electrical',
    'engineering — electronic materials',
    'engineering — integrated circuits',
    'engineering — manufacturing & design',
    'engineering — materials science',
    'engineering — mechanical',
    'engineering — signal processing and communications',
    'engineering — structural materials',
    'english',
    'environment and sustainability',
    'environmental science',
    'environmental health sciences',
    'environmental science & engineering',
    'epidemiology',
    'ethnomusicology',
    'european studies',
    'film & television',
    'financial actuarial mathematics',
    'financial engineering',
    'french',
    'french & francophone studies',
    'french and linguistics',
    'gender studies',
    'general chemistry',
    'genetic counseling',
    'geochemistry',
    'geography',
    'geography/environmental studies',
    'geology',
    'geophysics',
    'geophysics and space physics',
    'german',
    'germanic language',
    'global jazz studies',
    'global studies',
    'greek',
    'greek and latin',
    'health policy and management',
    'hispanic languages and literatures',
    'history',
    'human biology and society',
    'human genetics',
    'individual field arts and architecture',
    'individual field theater, film, and television',
    'individual field of concentration',
    'indo-european studies',
    'information studies',
    'international development studies',
    'iranian studies',
    'islamic studies',
    'italian',
    'italian and special fields',
    'jewish studies',
    'korean',
    'labor studies',
    'latin',
    'latin american studies',
    'latin american studies',
    'law',
    'legal studies mls',
    'library and information science',
    'linguistics',
    'linguistics and anthropology',
    'linguistics & asian languages & cultures',
    'linguistics and computer science',
    'linguistics and english',
    'linguistics and french',
    'linguistics and italian',
    'linguistics and philosophy',
    'linguistics and psychology',
    'linguistics and scandinavian languages',
    'linguistics and spanish',
    'management',
    'manufacturing engineering',
    'marine biology',
    'materials engineering',
    'materials science and engineering',
    'mathematics',
    'mathematics/applied science',
    'mathematics/economics',
    'mathematics for teaching',
    'mathematics of computation',
    'mechanical engineering',
    'microbiology, immunology, and molecular genetics',
    'middle eastern studies',
    'medicine',
    'molecular and medical pharmacology',
    'molecular biology',
    'molecular, cell, and developmental biology',
    'molecular, cellular, & integrative physiology',
    'molecular toxicology',
    'music',
    'music composition',
    'music education',
    'music history and industry',
    'music performance bm',
    'musicology',
    'near eastern languages and cultures',
    'neuroscience',
    'nordic studies',
    'nursing',
    'nursing practice',
    'oral biology',
    'philosophy',
    'physics',
    'physics and biology in medicine',
    'physiological science',
    'political science',
    'portuguese',
    'portuguese and brazilian studies',
    'psychobiology',
    'psychology',
    'public affairs',
    'public health',
    'public policy',
    'religion, study of',
    'russian studies',
    'scandinavian',
    'scandinavian languages and cultures',
    'slavic, east european, & eurasian languages & cultures',
    'social science',
    'social welfare',
    'sociology',
    'spanish',
    'spanish and community and culture',
    'spanish and linguistics',
    'spanish and portuguese',
    'special education joint with csula',
    'statistics',
    'teaching asian languages',
    'theater',
    'theater and performance studies',
    'urban and regional planning',
    'urban planning',
    'world arts and cultures'
  ],
};
