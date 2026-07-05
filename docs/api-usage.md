# DGIST Sugang API Usage

Last checked: 2026-07-05

This project keeps generated data in static files under `assets/` and the root
lecture JSON files. API calls require a logged-in DGIST Sugang session. Do not
commit `Cookie`, `JSESSIONID`, student number, or student name values.

## Current Data Refresh

| Endpoint | Purpose | Output |
| --- | --- | --- |
| `POST /ucr/ucrePreTlsnAplyMngt/listUp.do` | Fetch paginated opened lecture rows for 2026 Fall. Used with `pageNum`/`page` 1-11 and `rows=50`. | Cross-check against `lectures.json`, `lectures_eng.json`, and current opened course metadata. |
| `POST /ucr/ucreTlsnAplymMngt/comboSust.do` | Fetch available department codes for the current search context. | Confirmed `000018=기초학부`, `100112=반도체공학과`. |
| `POST /ucs/ucseLsnPdocMngt/lecInfo.do` | Fetch syllabus/detail JSON for one course section. Key params: `conYear=2026`, `conTerm=CMN17.20`, `conOrgn=CMN12.03`, `conSust`, `conSbjtNo`, `conClss`. | `assets/ags-section-details.json`, `assets/ags-section-detail-availability.csv`. |

## Detail Popup Adjacent Calls

These were captured from the official syllabus popup HAR and are documented so
future refreshes can tell which call provides which tab.

| Endpoint | Purpose |
| --- | --- |
| `POST /ucs/ucseLsnPdocMngt/lecTemtInfo.do` | Syllabus popup textbook/material tab. |
| `POST /ucs/ucseLsnPdocInpt/selectTab4.do` | Syllabus popup extra tab data. |
| `POST /ucs/ucseLsnPdocMngt/lecInfo.do` | Main syllabus/detail payload used by the app. |

## Course Registration Page Calls Observed

These calls are used by the Sugang page while opening the pre-registration view
or searching lectures. They are recorded for traceability; the app does not ship
live API clients.

| Endpoint | Observed role |
| --- | --- |
| `POST /usr/impStudInfo/impBaseInfoLang.do` | Student/base context lookup. |
| `POST /sch/schUtil/selectStudEarlyInfo.do` | Student early/registration context lookup. |
| `POST /sch/schUtil/getSchisYn.do` | Registration-history/check flag lookup. |
| `POST /ucr/ucreTlsnAplymMngt/comboSust.do` | Department/subject-unit combo data. |
| `POST /ucr/ucreTlsnAplymMngt/comboCptn.do` | Completion/classification combo data. |
| `POST /ucr/ucreTlsnAplymMngt/comboShyr.do` | Year-level combo data. |
| `POST /ucr/ucrePreTlsnAplyMngt/selectMaxCartNo.do` | Pre-registration cart sequence lookup. |
| `POST /ucr/ucrePreTlsnAplyMngt/listUp.do` | Search result/opened lecture list. |
| `POST /ucr/ucrePreTlsnAplyMngt/listDown.do` | Selected/current cart lecture list. |
| `POST /ucr/ucrePreTlsnAplyMngt/tlsnInfo.do` | Registration summary/credit info. |
| `POST /ajax/ucr/ucreTlsnAplycCart/getDetailView.do` | HTML detail popup used to verify schedule text for individual sections. |

## Refresh Notes

- `assets/ags-section-detail-availability.csv` is the audit table for which
  sections have accessible detailed syllabus JSON.
- `assets/ags-section-details.json` stores only successful `lecInfo.do`
  payloads.
- On 2026-07-05, unavailable/missing detail rows were rechecked against the CSV
  and current metadata. New detail payloads were added for `MECH303`, `MECH304`,
  `MSE303`, `PHY307`, `RP303`, `SM203a`, `SM306`, `SM307`, and `SM308`.
- `SM202` and `BE201` still returned empty syllabus responses at refresh time.
