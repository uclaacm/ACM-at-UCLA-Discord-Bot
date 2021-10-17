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
        email,
      ],
    },
    ReplyToAddresses: [],
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: `
<!DOCTYPE html>

<html lang="en" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:v="urn:schemas-microsoft-com:vml">
	<head>
		<title></title>
		<meta charset="utf-8"/>
		<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
		<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]-->
		<style>
* {
	box-sizing: border-box;
}

		th.column {
			padding: 0
		}

		a[x-apple-data-detectors] {
			color: inherit !important;
			text-decoration: inherit !important;
		}

		#MessageViewBody a {
			color: inherit;
			text-decoration: none;
		}

		p {
			line-height: inherit
		}

		@media (max-width:520px) {
			.icons-inner {
				text-align: center;
			}

			.icons-inner td {
				margin: 0 auto;
			}

			.row-content {
				width: 100% !important;
			}

			.image_block img.big {
				width: auto !important;
			}

			.stack .column {
				width: 100%;
				display: block;
			}
		}
		</style>
	</head>
	<body style="background-color: #fff; margin: 0; padding: 0; -webkit-text-size-adjust: none; text-size-adjust: none;">
		<table border="0" cellpadding="0" cellspacing="0" class="nl-container" role="presentation" style="mso-table-lspace: 0; mso-table-rspace: 0; background-color: #fff;" width="100%">
			<tbody>
				<tr>
					<td>
						<table align="center" border="0" cellpadding="0" cellspacing="0" class="row row-1" role="presentation" style="mso-table-lspace: 0; mso-table-rspace: 0;" width="100%">
							<tbody>
								<tr>
									<td>
										<table align="center" border="0" cellpadding="0" cellspacing="0" class="row-content stack" role="presentation" style="mso-table-lspace: 0; mso-table-rspace: 0;" width="500">
											<tbody>
												<tr>
													<th class="column" style="mso-table-lspace: 0; mso-table-rspace: 0; font-weight: 400; text-align: left; vertical-align: top;" width="100%">
														<table border="0" cellpadding="0" cellspacing="0" class="image_block" role="presentation" style="mso-table-lspace: 0; mso-table-rspace: 0;" width="100%">
															<tr>
																<td style="width:100%;padding-right:20px;padding-left:20px;padding-top:5px;">
																	<div align="center" style="line-height:10px"><img class="big" src="data:image/png;base64,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" style="display: block; height: auto; border: 0; width: 460px; max-width: 100%;" width="460"/></div>
																</td>
															</tr>
														</table>
														<table border="0" cellpadding="0" cellspacing="0" class="heading_block" role="presentation" style="mso-table-lspace: 0; mso-table-rspace: 0;" width="100%">
															<tr>
																<td style="width:100%;text-align:center;padding-right:20px;padding-left:20px;">
																	<h1 style="margin: 0; color: #555555; font-size: 23px; font-family: Arial, Helvetica Neue, Helvetica, sans-serif; line-height: 120%; text-align: center; direction: ltr; font-weight: normal; letter-spacing: normal; margin-top: 0; margin-bottom: 0;"><strong>Your verification code for the ACM at UCLA Discord Server</strong></h1>
																</td>
															</tr>
														</table>
														<table border="0" cellpadding="10" cellspacing="0" class="text_block" role="presentation" style="mso-table-lspace: 0; mso-table-rspace: 0; word-break: break-word;" width="100%">
															<tr>
																<td>
																	<div style="font-family: sans-serif">
																		<div style="font-size: 14px; color: #555555; line-height: 1.2; font-family: Arial, Helvetica Neue, Helvetica, sans-serif;">
																			<p style="margin: 0; font-size: 14px; text-align: center;">Hey there, ${name}! You signed up for the ACM at UCLA Discord Server using <strong><a href="mailto:${email}" style="color: #0068A5;">${email}</a></strong>. To complete your verification, please respond to the server's bot with the code below!</p>
																		</div>
																	</div>
																</td>
															</tr>
														</table>
														<table border="0" cellpadding="0" cellspacing="0" class="heading_block" role="presentation" style="mso-table-lspace: 0; mso-table-rspace: 0;" width="100%">
															<tr>
																<td style="width:100%;text-align:center;">
																	<h1 style="margin: 0; color: #000000; font-size: 42px; font-family: Arial, Helvetica Neue, Helvetica, sans-serif; line-height: 120%; text-align: center; direction: ltr; font-weight: normal; letter-spacing: normal; margin-top: 0; margin-bottom: 0;"><strong>${code}</strong></h1>
																</td>
															</tr>
														</table>
														<table border="0" cellpadding="0" cellspacing="0" class="text_block" role="presentation" style="mso-table-lspace: 0; mso-table-rspace: 0; word-break: break-word;" width="100%">
															<tr>
																<td style="padding-top:10px;padding-right:10px;padding-bottom:15px;padding-left:10px;">
																	<div style="font-family: sans-serif">
																		<div style="font-size: 14px; color: #555555; line-height: 1.2; font-family: Arial, Helvetica Neue, Helvetica, sans-serif;">
																			<p style="margin: 0; font-size: 14px; text-align: center;">If you did not make this request, please ignore this email.</p>
																		</div>
																	</div>
																</td>
															</tr>
														</table>
													</th>
												</tr>
											</tbody>
										</table>
									</td>
								</tr>
							</tbody>
						</table>
						<table align="center" border="0" cellpadding="0" cellspacing="0" class="row row-2" role="presentation" style="mso-table-lspace: 0; mso-table-rspace: 0;" width="100%">
							<tbody>
								<tr>
									<td>
										<table align="center" border="0" cellpadding="0" cellspacing="0" class="row-content stack" role="presentation" style="mso-table-lspace: 0; mso-table-rspace: 0;" width="500">
											<tbody>
												<tr>
													<th class="column" style="mso-table-lspace: 0; mso-table-rspace: 0; font-weight: 400; text-align: left; vertical-align: top;" width="100%">
														<table border="0" cellpadding="0" cellspacing="0" class="icons_block" role="presentation" style="mso-table-lspace: 0; mso-table-rspace: 0;" width="100%">
															<tr>
																<td style="color:#9d9d9d;font-family:inherit;font-size:15px;padding-bottom:10px;padding-top:10px;text-align:center;">
																	<table cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0; mso-table-rspace: 0;" width="100%">
																		<tr>
																			<td style="text-align:center;">
																				<!--[if vml]><table align="left" cellpadding="0" cellspacing="0" role="presentation" style="display:inline-block;padding-left:0px;padding-right:0px;mso-table-lspace: 0pt;mso-table-rspace: 0pt;"><![endif]-->
																				<!--[if !vml]><!-->
											<table cellpadding="0" cellspacing="0" class="icons-inner" role="presentation" style="mso-table-lspace: 0; mso-table-rspace: 0; display: inline-block; margin-right: -4px; padding-left: 0px; padding-right: 0px;">
											<!--<![endif]-->
											</table>
																			</td>
																		</tr>
																				</table>
																</td>
															</tr>
																	</table>
													</th>
												</tr>
											</tbody>
														</table>
									</td>
								</tr>
							</tbody>
										</table>
					</td>
				</tr>
			</tbody>
						</table><!-- End -->
	</body>
</html>
`,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: 'Discord | Please Verify Your Email Address',
      }
    },
  };

  return AWS_SES.sendEmail(params).promise();
};

module.exports = {
  sendVerification,
};
