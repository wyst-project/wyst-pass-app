# Security policy

Wyst Pass holds passwords and two factor secrets, so a report about it deserves a private channel first

## Reporting a vulnerability

Open a ticket on the Wyst Discord at https://discord.gg/wyst and say you have a security report, or use the private advisory form of this repository, and please do not open a public issue before we had a chance to answer

Useful in a report:

- what an attacker can reach, and from where
- the steps to reproduce it, even rough ones
- the version of the app and the system it runs on
- anything you already tried that did not work, it saves time

## What counts

- reading, writing or leaking vault data without the master password
- getting the vault key, the derived key or the master password out of memory, out of the local cache or out of the store file
- bypassing the lock, the session checks or the device sign in
- anything in the installer that lets code run where it should not, or that writes outside the install folder
- supply chain problems in the dependencies of the app

## What does not count

- a machine already compromised by malware, nothing in the app can save a device where the attacker is root
- a lost master password, there is no recovery by design
- reports produced only by an automated scanner, without a path to an actual impact
- the server side of Wyst, it is not in this repository

## Scope

This repository, the desktop app in `desktop` and the shared code in `src`

Thanks for taking the time, a valid report gets credited in the release notes if you want it
