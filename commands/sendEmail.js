const AWS = require('aws-sdk');
const config = require('../config.' + process.env.NODE_ENV_MODE);

const SES_CONFIG = {
  accessKeyId: process.env.AMAZON_SES_ACCESS_KEY,
  secretAccessKey: process.env.AMAZON_SES_SECRET_ACCESS_KEY,
  region: config.ses.region,
};

const AWS_SES = new AWS.SES(SES_CONFIG);

/* Send an email with verification code to user associated with email */
const sendVerification = (email, name, code) => {
  let params = {
    Source: config.ses.sender,
    Destination: {
      ToAddresses: [
        email
      ],
    },
    ReplyToAddresses: [],
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: `<p>Hi ${name},</p><br/><p>Your verification code for ${email} is ${code}.</p><br/><p>Best,<br/>ACM</p>`,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: `${name}, Here's your verification code!`,
      }
    },
  };
  return AWS_SES.sendEmail(params).promise();
};

module.exports = {
  sendVerification,
};
