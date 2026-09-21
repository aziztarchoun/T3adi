# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in this project, please **do not**
open a public GitHub issue.

Instead, please report it privately using GitHub's
["Report a vulnerability"](../../security/advisories/new) feature under
the Security tab of this repository. If that isn't available, open a
private discussion with a maintainer.

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce it
- Any relevant logs, screenshots, or proof-of-concept code

We'll do our best to acknowledge reports within a few days and keep you
updated as we work on a fix.

## Scope

This is a community-run open-source project without a dedicated security
team or bug bounty program. We take reports seriously but response times
depend on maintainer availability.

## Data handled by this project

This application intentionally minimizes personal data collection:

- Anonymous reporting requires only a randomly generated device token,
  never anything identifying.
- Optional accounts use Google OAuth; we do not store passwords.
- Report locations are hazard locations, not user location history.

If you believe you've found a way this design is being violated in
practice (e.g. more data being logged or stored than documented in
`docs/PROJECT_PLAN.md`), please report it as above — that's exactly the
kind of issue we want to know about.
