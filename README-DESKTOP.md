# Guitar Markdown Studio — application de bureau

Cette variante transforme l’éditeur web en application Electron installable.

## Développement

```bash
npm install
npm run desktop:dev
```

Vite démarre l’interface, puis Electron ouvre automatiquement la fenêtre de l’application.

## Tester la version construite

```bash
npm run desktop:start
```

## Créer un exécutable ou un installateur

Exécute la commande sur le système ciblé :

```bash
npm run desktop:make
```

Les fichiers sont créés dans `out/make/` :

- Windows : installateur `.exe` ;
- macOS : application `.app`, archive `.zip` et image `.dmg` ;
- Linux : paquets `.deb` et `.rpm`.

La compilation macOS doit être effectuée sur macOS. Pour produire facilement les trois plateformes, pousse le projet sur GitHub puis lance le workflow **Build desktop applications** dans l’onglet Actions.

## Fonctions natives

- ouverture d’un fichier `.md` ;
- enregistrement et mise à jour du fichier courant ;
- export PDF via la boîte de dialogue système ;
- stockage local automatique ;
- liens externes ouverts dans le navigateur par défaut.

## Signature des applications

Les builds locaux ne sont pas signés. Pour une diffusion publique, configure un certificat de signature Windows et un certificat Apple Developer avec notarisation macOS dans ton environnement CI.
