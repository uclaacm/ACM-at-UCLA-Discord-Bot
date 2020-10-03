module.exports = {
  db_path: './userinfo.db',
  allowed_domains: ['ucla.edu'],
  discord: {
    server_id: '702801010426511373',
    verified_role_name: 'Verified',
  },
  sendgrid: {
    template_id: 'd-b50eca776df84deab80256f097286492',
    sender: 'acm@ucla.edu',
  },
  default_msgs: {
    welcome: 'Welcome to the official ACM at UCLA Discord server.',
  }
};
