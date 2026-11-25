# Code signing policy

Free code signing provided by SignPath.io, certificate by SignPath Foundation.

H-IMAGO is a free, open-source desktop application for historical prosopography and
the visualization of historical social networks. Windows builds will be code-signed
from the first release published after SignPath Foundation approves the project.

## Signed artifacts

- `H-IMAGO.exe` — the application executable included in the installer and the
  portable ZIP.
- `H-IMAGO-<version>-Setup.exe` — the Windows x64 NSIS installer.
- `H-IMAGO-<version>-win-x64-portable.zip` — the portable distribution. It contains
  the signed `H-IMAGO.exe`; the ZIP container itself is not Authenticode-signed.

The application executable is signed first. The installer is then built around the
signed executable and signed in a second request.

## Linux artifacts

Linux artifacts are outside the scope of Authenticode and SignPath. From version
0.0.29, each release publishes `SHA256SUMS-linux.txt` and a GitHub build provenance
attestation for the AppImage and the `.deb` package. The workflow is
[`.github/workflows/linux-release.yml`](.github/workflows/linux-release.yml).

```bash
sha256sum -c SHA256SUMS-linux.txt
gh attestation verify H-IMAGO-<version>.AppImage --repo mre1302/H-Imago
```

## Build and signing process

- Source code: <https://github.com/mre1302/H-Imago>
- Workflow: [`.github/workflows/windows-release.yml`](.github/workflows/windows-release.yml)
- Builds run on GitHub-hosted `windows-latest` runners from the public repository.
- The workflow runs `npm ci`, the project checks and the Windows x64 build.
- Before packaging, the workflow verifies that the executable metadata contains the
  product name `H-IMAGO` and the version from `package.json`.
- The unsigned executable is submitted to SignPath.io. After approval, it is
  downloaded, its Authenticode signature is verified, and it replaces the unsigned
  executable before the installer is built.
- The installer is submitted to SignPath.io in a second request, approved, verified
  and published.
- Private keys are generated and held by SignPath.io in a Hardware Security Module
  (HSM). The project does not store or have access to the private key.
- Every signing request requires manual approval by the project approver.
- SignPath verifies that the signed artifacts originate from this repository and
  from the recorded GitHub Actions build.

## Roles

- Authors: [@mre1302](https://github.com/mre1302)
- Reviewers: [@mre1302](https://github.com/mre1302)
- Approvers: [@mre1302](https://github.com/mre1302)

The project currently has a single maintainer, so the same person holds the author,
reviewer and approver roles. Contributions from other people are reviewed before
being merged. All maintainers use multi-factor authentication for GitHub and
SignPath.

## Privacy

- Website privacy and content notice:
  <https://mre1302.github.io/H-Imago/contenido.html>
- The desktop application stores its data locally by default (SQLite). It connects
  to an external MySQL server only when the user configures one, and it requests map
  tiles only when the user opens the georeferencer. The desktop application does not
  include telemetry.

## Verification

Windows:

```powershell
Get-AuthenticodeSignature .\H-IMAGO-<version>-Setup.exe
Get-FileHash .\H-IMAGO-<version>-Setup.exe -Algorithm SHA256
```

Linux:

```bash
sha256sum -c SHA256SUMS-linux.txt
gh attestation verify H-IMAGO-<version>.AppImage --repo mre1302/H-Imago
```

The Windows signature is issued by SignPath Foundation. The Linux artifacts are
not Authenticode-signed; their integrity is covered by the checksum file and the
GitHub attestation.

## Contact

- Issues and questions: <https://github.com/mre1302/H-Imago/discussions>
- Email: <contacto@h-imago.org>

This policy applies to Windows artifacts published after SignPath Foundation approves
the project. Older releases, including 0.0.28, were published unsigned.
