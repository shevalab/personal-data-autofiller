# Personal Data Form Field Identifiers

A comprehensive list of common HTML form field names, IDs, placeholders, labels, and `autocomplete` values used across the web for personal data — especially useful for travel booking, passport, and registration forms.

Use these keywords (case-insensitive) after normalizing spaces, underscores, and hyphens. Match against `name`, `id`, `placeholder`, `aria-label`, `autocomplete`, `data-testid`, and nearby `<label>` text.

---

## 1. Full Name

```
name
fullname
full_name
full-name
full name
passengername
passenger_name
passenger-name
travelername
traveler_name
travellername
traveller_name
passportname
passport_name
passport-name
nameonpassport
legalname
legal_name
completename
yourname
your_name
```

**HTML autocomplete:** `name`

---

## 2. First / Given Name

```
firstname
first_name
first-name
first name
fname
f-name
firstn
givenname
given_name
given-name
given names
givenname(s)
forename
forenames
prenom
```

**HTML autocomplete:** `given-name`

---

## 3. Middle Name / Additional Name

```
middlename
middle_name
middle-name
middle name
mname
m-name
additionalname
additional_name
additional-name
middleinitial
middle_initial
middle-initial
middlenameinitial
```

**HTML autocomplete:** `additional-name`

---

## 4. Last / Family / Surname

```
lastname
last_name
last-name
last name
lname
l-name
lastn
surname
familyname
family_name
family-name
family name
s-name
secondname
second_name
```

**HTML autocomplete:** `family-name`

---

## 5. Title / Prefix / Suffix

```
title
prefix
honorific
honorificprefix
honorific-prefix
mr
mrs
ms
miss
dr
suffix
honorificsuffix
honorific-suffix
jr
sr
ii
iii
```

**HTML autocomplete:** `honorific-prefix`, `honorific-suffix`

---

## 6. Passport / Travel Document Number

```
passport
passportnumber
passport_number
passport-number
passport no
passportid
passport_id
passport-id
passportnum
passport_num
documentnumber
document_number
document-number
docnumber
doc_number
documentno
document_no
traveldocumentnumber
travel document number
idnumber
id_number
id-number
identitynumber
identity_number
docnum
documentid
document_id
```

**Related Chromium types:** `PASSPORT_NUMBER`

---

## 7. Passport Issue Date

```
issuedate
issue_date
issue-date
dateofissue
date_of_issue
passportissuedate
passport_issue_date
passportissue
issued on
dateissued
date_issued
issued
issuedat
issue
```

---

## 8. Passport Expiry / Expiration Date

```
expiry
expirydate
expiry_date
expiry-date
expiration
expirationdate
expiration_date
expiration-date
expiredate
expire_date
expires
passportexpiry
passport_expiry
passportexpiration
passport_expiration
validuntil
valid_until
validto
valid_to
documentexpiry
document_expiry
```

**Related Chromium types:** `PASSPORT_EXPIRATION_DATE`

---

## 9. Date of Birth

```
dob
dateofbirth
date_of_birth
date-of-birth
birthdate
birth_date
birth-date
birthday
birth_day
birth-day
bday
passengerdob
passenger_dob
travelerdob
date born
born
```

**HTML autocomplete:** `bday`, `bday-day`, `bday-month`, `bday-year`

---

## 10. Gender / Sex

```
gender
sex
genderaslisted
gender_as_listed
passenger gender
sexaslisted
```

**HTML autocomplete:** `sex`  
Common values: `M`, `F`, `Male`, `Female`, `X`, `U`, `MI`, `FI`

---

## 11. Nationality / Citizenship

```
nationality
citizenship
countryofcitizenship
country_of_citizenship
nationalitycode
citizen
citizenshipcountry
countryofnationality
passportnationality
nationality country
```

---

## 12. Country of Issue / Issuing Country

```
issuingcountry
issuing_country
countryofissue
country_of_issue
issuecountry
issue_country
passportcountry
passport_country
countryofissuance
documentcountry
issuingstate
```

**Related Chromium types:** `PASSPORT_ISSUING_COUNTRY`

---

## 13. Phone / Mobile

```
phone
telephone
mobile
cellphone
cell_phone
cell-phone
phonenumber
phone_number
phone-number
tel
contactphone
contact_phone
mobilephone
mobile_phone
daytimephone
homephone
workphone
businessphone
eveningphone
```

**HTML autocomplete:** `tel`, `tel-national`, `tel-country-code`, `tel-area-code`, `tel-local`, `mobile tel`, `home tel`, `work tel`

---

## 14. Email

```
email
e-mail
emailaddress
email_address
email-address
mail
contactemail
contact_email
e_mail
```

**HTML autocomplete:** `email`

---

## 15. Address-related

```
address
street
streetaddress
street_address
addressline1
address_line1
address1
address-line-1
city
locality
town
state
province
region
zip
zipcode
postal
postalcode
postal_code
postcode
country
countryname
country_name
countrycode
```

**HTML autocomplete:** `street-address`, `address-line1`, `address-line2`, `address-level1`, `address-level2`, `postal-code`, `country`, `country-name`

---

## 16. Frequent Flyer / Loyalty / Known Traveler

```
frequentflyer
frequent_flyer
ffnumber
ff_number
loyalty
loyaltynumber
knowntraveler
known_traveler
knowntraveler number
ktn
redress
redressnumber
```

---

## 17. Passenger / Traveler Index Patterns (multi-passenger forms)

Look for these combined with any of the field keywords above:

```
passenger1
passenger_1
passenger-1
pax1
pax_1
traveler1
traveler_1
traveller1
guest1
person1
adult1
[0]
[1]
_0
_1
-0
-1
```

Also common in frameworks:
```
Passenger[0].FirstName
travelers[1].passportNumber
passengerInfo[2].dateOfBirth
```

---

## Recommended Matching Strategy

1. **Normalize** attribute text: lowercase + remove spaces / `_` / `-`.
2. Check the `autocomplete` attribute first (most reliable when present).
3. Then check `name` + `id` + `placeholder` + `aria-label` + `data-testid`.
4. Fall back to associated `<label>` text.
5. For multi-passenger pages, prefer fields that also contain a passenger index matching the selected profile order.
6. When only a single “name” field exists → put the full name.  
   When first + last fields exist → split the stored full name.

---

## Sources

- HTML Living Standard `autocomplete` attribute
- Airline / GDS booking patterns (Amadeus, Sabre, Travelport)
- APIS / DOCS / Secure Flight passenger data fields
- Browser autofill implementations (Chromium, Safari, Bitwarden)
- Real-world flight booking, visa, and arrival-card forms

*Compiled for extending the Personal Data Autofiller browser extension matching logic.*
