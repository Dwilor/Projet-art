export const works = [
  {
    id: "art-001",
    reference: "ART-001",
    image: "art-001",
    alt: "Composition abstraite : courbe terracotta, forme verticale noire et traces olive sur fond crème.",
  },
  {
    id: "art-002",
    reference: "ART-002",
    image: "art-002",
    alt: "Composition abstraite de courbes terracotta, crème et olive autour d’une forme noire.",
  },
  {
    id: "art-003",
    reference: "ART-003",
    image: "art-003",
    alt: "Composition abstraite avec une grande forme noire, une courbe terracotta et des touches olive.",
  },
  {
    id: "art-004",
    reference: "ART-004",
    image: "art-004",
    alt: "Composition abstraite de formes horizontales olive et noires et d’une large forme terracotta.",
  },
  {
    id: "art-005",
    reference: "ART-005",
    image: "art-005",
    alt: "Composition abstraite : cercle terracotta, trait vertical noir et courbes fines sur fond clair.",
  },
];
export const biography = [
  "Je suis Sirius. J’ai toujours été attiré par les couleurs, les formes et les matières, mais la peinture est longtemps restée quelque chose que j’admirais de loin. Il y a quelques années, j’ai eu envie de créer de mes mains, loin des écrans et du rythme du quotidien. J’ai commencé simplement, avec quelques toiles, des pinceaux et de la peinture.",
  "Au début, je cherchais à reproduire ce que je voyais. Peu à peu, je me suis tourné vers l’abstraction. J’aime explorer l’équilibre entre les formes, les couleurs et les espaces, sans chercher à représenter quelque chose de précis.",
  "L’architecture, les paysages et les textures naturelles nourrissent mon travail. Je superpose les couches, j’expérimente avec différents outils et je laisse apparaître certaines traces du geste. Les imperfections font partie de ce qui m’intéresse.",
  "Je peins pendant mon temps libre, en prenant le temps d’essayer, de recommencer et de revenir sur une toile. Aujourd’hui, j’ai envie de partager cet univers et d’échanger avec les personnes qui y sont sensibles.",
];
export const money = (cents) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
