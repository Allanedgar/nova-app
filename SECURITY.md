# Security Policy

**Last Updated:** 2026-01-15
**Version:** 0.1.0

---

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### DO NOT

- ❌ Open a public GitHub issue for security vulnerabilities
- ❌ Post about the vulnerability on social media
- ❌ Exploit the vulnerability beyond proof of concept

### DO

- ✅ Email us at: **security@arbitrage-pro.com**
- ✅ Include detailed description of the vulnerability
- ✅ Include steps to reproduce
- ✅ Include potential impact assessment
- ✅ Allow us 90 days to address before public disclosure

### PGP Key

For encrypted communication, use our PGP key:
```
[PGP key fingerprint will be published here]
```

---

## Security Best Practices

### For Users

1. **Never share API keys** — Not with support, not in issues, not anywhere public
2. **Use MFA** — Multi-factor authentication is required for trading accounts
3. **Rotate keys regularly** — Change API keys every 90 days
4. **Use read-only keys** — Only grant necessary permissions
5. **Monitor activity** — Check execution logs regularly
6. **Keep software updated** — Use the latest release

### For Developers

1. **Never commit secrets** — Use environment variables or Vault
2. **Validate all inputs** — Use Zod schemas at API boundaries
3. **Use parameterized queries** — Prevent SQL injection
4. **Escape outputs** — Prevent XSS
5. **Implement rate limiting** — Prevent abuse
6. **Log security events** — Audit trail for all sensitive actions
7. **Encrypt sensitive data** — AES-256-GCM at rest
8. **Use TLS 1.3** — All external communications

---

## Supported Versions

| Version | Supported | Security Updates |
|---|---|---|
| 0.1.x (current) | ✅ Yes | Active development |
| 0.0.x | ❌ No | End of life |

---

## Security Features

### Authentication
- JWT with 15-minute expiration
- Refresh tokens with 7-day expiration
- TOTP-based MFA (Google Authenticator, Authy)
- Session management with concurrent session limits

### Authorization
- Role-Based Access Control (RBAC)
- 5 roles: admin, trader, analyst, developer, readonly
- Fine-grained permissions per role
- Resource-level access control

### Data Protection
- AES-256-GCM encryption at rest
- TLS 1.3 encryption in transit
- Database Row Level Security (RLS)
- Audit logs with HMAC integrity chain

### Monitoring
- Immutable audit logging
- Real-time security event monitoring
- Anomaly detection
- Automated alerting for suspicious activity

### Incident Response
- 24/7 on-call rotation
- 1-hour response time for P1 incidents
- Post-mortem within 48 hours
- Regular security audits

---

## Known Limitations

1. **Smart Contract Risk** — While we audit DEX interactions, smart contract vulnerabilities in external protocols are outside our control
2. **MEV Exposure** — Users trading on DEXs are exposed to MEV (maximal extractable value)
3. **Regulatory Compliance** — Users are responsible for complying with local regulations
4. **Exchange Risk** — Exchange hacks or failures can result in loss of funds

---

## Disclosure Policy

When we discover a vulnerability:

1. **Internal assessment** — Determine severity and impact
2. **Patch development** — Fix the vulnerability
3. **Testing** — Verify the fix
4. **Release** — Deploy patch to production
5. **Disclosure** — Publish advisory after patch is deployed
6. **Credit** — Acknowledge reporter (unless anonymous)

### Timeline

- Critical vulnerabilities: 24-48 hours
- High severity: 7 days
- Medium/Low severity: 30 days

---

## Bug Bounty Program

Starting at v1.0 launch, we will run a bug bounty program through [Immunefi](https://immunefi.com/).

**Rewards:**
- Critical: $10,000 - $50,000
- High: $2,000 - $10,000
- Medium: $500 - $2,000
- Low: $100 - $500

**Scope:**
- Production API (api.arbitrage-pro.com)
- Smart contracts (if applicable)
- Desktop and mobile applications

**Out of Scope:**
- Testnet/staging environments
- Third-party dependencies (report to upstream)
- Social engineering attacks
- Physical attacks

---

## Security Audit History

| Date | Auditor | Scope | Report |
|---|---|---|---|
| 2026-Q4 | [TBD] | Smart contracts, backend | [Pending] |

---

## Security Contacts

- **Security Team**: security@arbitrage-pro.com
- **General Contact**: maintainers@arbitrage-pro.com
- **Discord**: @security-officer (for general questions only)

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CIS Controls](https://www.cisecurity.org/controls)

---

## Engineering Notes

- This policy is reviewed quarterly
- Updated after each security incident
- All team members must complete security training
- Security is everyone's responsibility