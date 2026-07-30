# Optional extra CA certificate

If your network routes egress through a TLS-intercepting proxy, drop that
proxy's root certificate here as `ca.crt`. The image build picks it up
automatically for npm and Node; if the file is absent the build is unaffected.

`ca.crt` is git-ignored — do not commit a corporate certificate.
