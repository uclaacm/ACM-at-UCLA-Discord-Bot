# Email Verification Bot for Discord
A Discord Bot to verify domain email addresses for server permissions (via assigned role) without directly associating the email address with their discord account.

Verified usernames are stored with their email address in an `sqlite3` database and can be queried for moderation reasons.



## Setup

### SendGrid

- get an API key and put it in `.env`  (read below)
- put the sender email address in `config.js` (read below)

- create a dynamic template with the following handlebars
  - `{{nickname}}`
  - `{{code}}`
  - `{{email}}`



### Discord App

- put the Server ID in `config.js` (read below)
- get an API key for your application and put it in `.env` (read below)



### API Keys

Create a `.env` file to store all your secret tokens and API Keys.

```bash
echo "export SENDGRID_API_KEY=<insert_sendgrid_api_key>" >> .env
echo "export DISCORD_API_KEY=<insert_discord_app_api_key>" >> .env
```



### Config file

Use `config.js` to set the following parameters,

```js
{
  db_path: '<db_relative_location>',
  allowed_domains: ['domain1.com', 'domain2.com'],
  discord: {
    server_id: '<discord_server_id>',
    verified_role_name: 'Verified',
  },
  sendgrid: {
    template_id: '<dynamic_template_id>',
    sender: '<verified_sender_id>',
  },
}
```



## Running

```bash
npm run start
```

