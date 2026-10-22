# MailPulse SMTP Integration Guide

MailPulse runs an RFC 5321 compliant SMTP server on `127.0.0.1:1025` by default. It accepts any credentials or unauthenticated requests.

## Framework Configurations

### Node.js (Nodemailer)

```typescript
import nodemailer from "nodemailer";

export const mailer = nodemailer.createTransport({
  host: "127.0.0.1",
  port: 1025,
  secure: false,
  ignoreTLS: true,
});

export async function sendWelcomeEmail(to: string, code: string) {
  return mailer.sendMail({
    from: '"Acme Security" <security@example.com>',
    to,
    subject: `Your verification code is ${code}`,
    text: `Your one-time code is ${code}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Verify Your Email</h2>
        <p>Your one-time code is:</p>
        <h1 style="letter-spacing: 4px; color: #2563eb;">${code}</h1>
        <p>This code expires in 10 minutes.</p>
      </div>
    `,
  });
}
```

### Python (Django)

In your `settings.py`:

```python
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "127.0.0.1"
EMAIL_PORT = 1025
EMAIL_USE_TLS = False
EMAIL_USE_SSL = False
EMAIL_HOST_USER = ""
EMAIL_HOST_PASSWORD = ""
```

### Ruby on Rails

In `config/environments/development.rb`:

```ruby
config.action_mailer.delivery_method = :smtp
config.action_mailer.smtp_settings = {
  address: "127.0.0.1",
  port: 1025,
  enable_starttls_auto: false
}
```

### Laravel (.env)

```dotenv
MAIL_MAILER=smtp
MAIL_HOST=127.0.0.1
MAIL_PORT=1025
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="${APP_NAME}"
```

### Spring Boot (`application.properties`)

```properties
spring.mail.host=127.0.0.1
spring.mail.port=1025
spring.mail.properties.mail.smtp.auth=false
spring.mail.properties.mail.smtp.starttls.enable=false
```

### Go (`net/smtp`)

```go
package main

import (
	"fmt"
	"net/smtp"
)

func SendTestEmail(to string, otp string) error {
	msg := []byte(fmt.Sprintf(
		"From: Acme <auth@example.com>\r\n"+
			"To: %s\r\n"+
			"Subject: Verification Code %s\r\n"+
			"Content-Type: text/html; charset=UTF-8\r\n\r\n"+
			"<html><body><p>Your code is <b>%s</b></p></body></html>\r\n",
		to, otp, otp,
	))

	return smtp.SendMail("127.0.0.1:1025", nil, "auth@example.com", []string{to}, msg)
}
```

### Docker Compose Integration

If your application runs inside Docker while MailPulse runs on your host machine, configure your app container to connect using `host.docker.internal`:

```yaml
version: '3.8'
services:
  app:
    build: .
    environment:
      - SMTP_HOST=host.docker.internal
      - SMTP_PORT=1025
```
