# Mise en ligne sur Render + Supabase

Un seul service web Node sert les pages (`public/`) et l'API Pi (`core/handler.js`). Les données sont dans Supabase (Postgres).

## 1. Base de données (Supabase)
1. Projet Supabase `biostar-monde-eden`.
2. Exécuter `supabase/schema.sql` (éditeur SQL) : crée les tables `bsme_*` avec la sécurité par ligne activée et **aucune politique publique** (seul le serveur, avec la clé `service_role`, y accède).
3. Récupérer l'adresse du projet et la clé **service_role** (Paramètres, API). Cette clé est secrète : jamais dans le dépôt, jamais côté navigateur.

## 2. Service web (Render)
1. Nouveau service web relié au dépôt GitHub, branche `main` (ou « Blueprint » avec `render.yaml`).
2. Runtime Node 22, build `npm install --omit=dev`, démarrage `npm start`, chemin de santé `/api/health`.
3. Variables d'environnement (les secrets en « secret ») :
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (secret), `SUPABASE_TABLE_PREFIX=bsme_`
   - `PI_API_KEY` (secret) : clé de l'application **Testnet** du Developer Portal
   - `PI_NETWORK=testnet`, `PI_SANDBOX=false`
   - `ADMIN_USERNAMES` : nom d'utilisateur Pi du promoteur, sans @
   - `PI_VALIDATION_KEY` : clé « Verify domain » (étape 4)
   - `NODE_ENV=production`, `APP_URL` : l'adresse du service
4. Auto-Deploy : **Yes**. Ne jamais confirmer un « Rollback » sur Render : il rétablit d'anciennes variables d'environnement.
5. Le plan gratuit s'endort : la première ouverture peut prendre une minute.

## 3. Vérifier
Ouvrir `https://<adresse>/api/health` : `piApiKeyConfigured` doit valoir `true`, `database` doit valoir `supabase`.

## 4. Brancher sur Pi (Developer Portal)
1. Application **Testnet** : champ Production URL = l'adresse exacte du service, **sans point, sans espace, sans `/` final**.
2. Copier la clé « Verify domain » dans `PI_VALIDATION_KEY` (Render), attendre le redéploiement, puis ouvrir `/validation-key.txt` : il doit afficher la clé. Appuyer ensuite sur **Verify**.
3. Pi App Studio demande aussi le fichier `/pi-app-validation.txt` (déjà présent dans `public/`) : il doit contenir uniquement le jeton affiché par App Studio. La connexion est vérifiée côté serveur par `GET https://api.minepi.com/v2/me` (sans clé API) ; en secours, par un échange du jeton d'accès avec App Studio.
4. Une adresse par application Pi : ne pas réutiliser la même adresse pour le Testnet et le Mainnet.

## 5. Tester dans le Pi Browser
Ouvrir l'application depuis `develop.pi`, appuyer sur **Connexion Pi**, puis payer une petite offre de test. Vérifier ensuite l'inscription dans « Mes inscriptions » et dans la table `bsme_orders`.

## Passage au Mainnet
Nouvelle application Mainnet, nouvelle adresse vérifiée, nouvelle clé API, `PI_NETWORK=mainnet`, et séparation des données (autre préfixe, par exemple `SUPABASE_TABLE_PREFIX=main_` avec un schéma correspondant, ou autre projet Supabase).
