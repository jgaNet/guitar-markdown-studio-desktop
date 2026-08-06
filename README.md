# Guitar Markdown Studio — VexFlow

Éditeur de cours de guitare en deux colonnes : Markdown à gauche, rendu vectoriel à droite.

## Architecture

- `@gms/guitar-markdown` transforme les blocs spécialisés en AST.
- `@gms/renderer-vexflow` produit les tablatures SVG.
- `@gms/renderer-svguitar` produit les diagrammes d'accords SVG.
- `apps/editor` fournit l'éditeur web Vite.
- `@gms/exporter-pdf` imprime le rendu avec Puppeteer.

Le texte Markdown reste la source de vérité. Le SVG n'est pas stocké dans les cours.

## Installation

```bash
npm install
npm run dev
```

Ouvrir ensuite l'adresse indiquée par Vite, généralement `http://localhost:5173`.

## Tablatures

````markdown
```tab
    Em              C
e|------0-------|------0-------|
B|----0---0-----|----1---1-----|
G|--0-------0---|--0-------0---|
D|--------------|2-------------|
A|2-------------|3-------------|
E|0-------------|--------------|
```
````

Le parser regroupe les notes placées à la même colonne en un seul événement. Chaque section séparée par `|` devient une mesure.

Techniques reconnues dans l'AST et dans le rendu :

```text
e|--5h7--7p5--5/7--7\5~--|
B|--------------8b10------|
```

- `h` : hammer-on
- `p` : pull-off
- `/` et `\` : slides
- `b` : bend
- `~` : vibrato
- `x` : note étouffée

## Diagrammes d'accords

````markdown
```chords
Em 022000
C  x32010
G  320003
D  xx0232
```
````

Les six caractères représentent les cordes de la plus grave à la plus aiguë. `x` signifie corde muette et `0` corde à vide.

## Autres blocs

````markdown
```rhythm
Comptage : 1 & 2 & 3 & 4 &
Mouvement: ↓   ↓ ↑   ↑ ↓ ↑
```

```grid
| Em | C | G | D |
```

```song
[Em]Texte avec les [C]accords
```
````

## Construire et exporter un PDF

```bash
npm run build
npm run preview
```

Installer Puppeteer pour l’export automatisé :

```bash
npm install --save-dev puppeteer
```

Dans un autre terminal :

```bash
npm run export:pdf -- http://localhost:4173 ./cours.pdf
```

Le bouton **Imprimer / PDF** du navigateur fonctionne également.

## Tests

```bash
npm test
```

## Limites de cette première version

La durée musicale est actuellement déduite du nombre d'événements présents dans une mesure. La position horizontale de l'ASCII sert à regrouper les notes simultanées, mais ne représente pas encore une quantification rythmique exacte. Le prochain jalon consiste à ajouter une ligne de comptage ou une syntaxe explicite de durée.
