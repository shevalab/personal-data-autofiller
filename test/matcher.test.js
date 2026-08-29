'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const matcher = require('../matcher.js');
const { classify, autocompleteBucket, extractPassengerNum, detectOffset, assignFields, normalize, matchesAny } = matcher;

// A tiny helper: classify a field from a name/id/placeholder etc.
function nameClass(name, autocomplete) {
  return classify(name, autocomplete);
}

test('normalize strips spaces, underscores, hyphens and lowercases', () => {
  assert.equal(normalize('First Name'), 'firstname');
  assert.equal(normalize('full_name'), 'fullname');
  assert.equal(normalize('E-MAIL'), 'email');
});

test('matchesAny matches whole tokens only, not substrings', () => {
  assert.equal(matchesAny('first_name', ['first_name']), true);
  assert.equal(matchesAny('first_name', ['name']), true);
  assert.equal(matchesAny('first_name', ['surname']), false);
  assert.equal(matchesAny('address', ['dr']), false);
  assert.equal(matchesAny('email_address', ['ms']), false);
});

// ---------------------------------------------------------------------------
// 1. Full name
// ---------------------------------------------------------------------------
test('full name keywords map to fullName', () => {
  for (const k of ['name', 'fullname', 'full_name', 'full_name', 'passengername', 'passenger_name', 'travelername', 'travellername', 'passportname', 'legalname', 'completename', 'yourname']) {
    assert.ok(nameClass(k).includes('fullName'), `${k} should classify as fullName (got ${nameClass(k)})`);
  }
});

test('autocomplete "name" maps to fullName', () => {
  assert.equal(autocompleteBucket('name'), 'fullName');
  assert.ok(nameClass('someone', 'name').includes('fullName'));
});

// ---------------------------------------------------------------------------
// 2. First / given name
// ---------------------------------------------------------------------------
test('first name keywords map to firstName', () => {
  for (const k of ['firstname', 'first_name', 'first-name', 'fname', 'f-name', 'givenname', 'given_name', 'forename', 'forenames', 'prenom', 'firstn']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('firstName'), `${k} should classify as firstName (got ${buckets})`);
  }
});

test('autocomplete "given-name" maps to firstName', () => {
  assert.equal(autocompleteBucket('given-name'), 'firstName');
});

// ---------------------------------------------------------------------------
// 3. Middle name
// ---------------------------------------------------------------------------
test('middle name keywords map to middleName', () => {
  for (const k of ['middlename', 'middle_name', 'mname', 'm-name', 'additionalname', 'additional_name', 'middleinitial', 'middle_initial', 'middlenameinitial']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('middleName'), `${k} should classify as middleName (got ${buckets})`);
  }
});

test('autocomplete "additional-name" maps to middleName', () => {
  assert.equal(autocompleteBucket('additional-name'), 'middleName');
});

// ---------------------------------------------------------------------------
// 4. Last / family name
// ---------------------------------------------------------------------------
test('last name keywords map to lastName', () => {
  for (const k of ['lastname', 'last_name', 'lname', 'l-name', 'lastn', 'surname', 'familyname', 'family_name', 'secondname', 'second_name', 's-name']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('lastName'), `${k} should classify as lastName (got ${buckets})`);
  }
});

test('autocomplete "family-name" maps to lastName', () => {
  assert.equal(autocompleteBucket('family-name'), 'lastName');
});

// ---------------------------------------------------------------------------
// 5. Title / prefix / suffix
// ---------------------------------------------------------------------------
test('title / prefix / suffix keywords map to title', () => {
  for (const k of ['title', 'prefix', 'honorific', 'honorificprefix', 'honorific-prefix', 'suffix', 'honorificsuffix', 'honorific-suffix', 'jr', 'sr', 'ii', 'iii']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('title'), `${k} should classify as title (got ${buckets})`);
  }
});

test('autocomplete honorific maps to title', () => {
  assert.equal(autocompleteBucket('honorific-prefix'), 'title');
  assert.equal(autocompleteBucket('honorific-suffix'), 'title');
});

// ---------------------------------------------------------------------------
// 6. Passport number
// ---------------------------------------------------------------------------
test('passport / document number keywords map to passport', () => {
  for (const k of ['passport', 'passportnumber', 'passport_number', 'passport no', 'passportid', 'passport_num', 'documentnumber', 'doc_number', 'documentno', 'traveldocumentnumber', 'idnumber', 'identity_number', 'docnum', 'document_id']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('passport'), `${k} should classify as passport (got ${buckets})`);
  }
});

// ---------------------------------------------------------------------------
// 7. Passport issue date
// ---------------------------------------------------------------------------
test('passport issue date keywords map to passportIssuedAt', () => {
  for (const k of ['issuedate', 'issue_date', 'dateofissue', 'date_of_issue', 'passportissuedate', 'passport_issue_date', 'issued on', 'dateissued']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('passportIssuedAt'), `${k} should classify as passportIssuedAt (got ${buckets})`);
  }
});

test('passport issue date field (name "passport_issued_at" / label "Passport issued at") maps to passportIssuedAt', () => {
  for (const k of ['passport_issued_at', 'passport issued at', 'issued_at', 'passport issued']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('passportIssuedAt'), `${k} should classify as passportIssuedAt (got ${buckets})`);
  }
});

// ---------------------------------------------------------------------------
// 8. Passport expiry
// ---------------------------------------------------------------------------
test('passport expiry keywords map to passportExpiresAt', () => {
  for (const k of ['expiry', 'expirydate', 'expiration', 'expiredate', 'expires', 'passportexpiry', 'passportexpiration', 'validuntil', 'valid_to', 'documentexpiry']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('passportExpiresAt'), `${k} should classify as passportExpiresAt (got ${buckets})`);
  }
});

// ---------------------------------------------------------------------------
// 9. Date of birth
// ---------------------------------------------------------------------------
test('date of birth keywords map to dob', () => {
  for (const k of ['dob', 'dateofbirth', 'date_of_birth', 'birthdate', 'birth_date', 'birthday', 'bday', 'passengerdob', 'travelerdob', 'date born', 'born']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('dob'), `${k} should classify as dob (got ${buckets})`);
  }
});

test('autocomplete bday maps to dob', () => {
  for (const v of ['bday', 'bday-day', 'bday-month', 'bday-year']) {
    assert.equal(autocompleteBucket(v), 'dob');
  }
});

// ---------------------------------------------------------------------------
// 10. Gender / sex
// ---------------------------------------------------------------------------
test('gender keywords map to gender', () => {
  for (const k of ['gender', 'sex', 'genderaslisted', 'gender_as_listed', 'sexaslisted', 'passenger gender']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('gender'), `${k} should classify as gender (got ${buckets})`);
  }
});

test('autocomplete "sex" maps to gender', () => {
  assert.equal(autocompleteBucket('sex'), 'gender');
});

// ---------------------------------------------------------------------------
// 11. Nationality / citizenship
// ---------------------------------------------------------------------------
test('nationality keywords map to nationality', () => {
  for (const k of ['nationality', 'citizenship', 'countryofcitizenship', 'country_of_citizenship', 'nationalitycode', 'citizen', 'citizenshipcountry', 'passportnationality', 'nationality country']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('nationality'), `${k} should classify as nationality (got ${buckets})`);
  }
});

test('autocomplete country-name maps to nationality', () => {
  assert.equal(autocompleteBucket('country-name'), 'nationality');
});

// ---------------------------------------------------------------------------
// 12. Country of issue
// ---------------------------------------------------------------------------
test('issuing-country keywords map to passportIssuedCountry', () => {
  for (const k of ['issuingcountry', 'issuing_country', 'countryofissue', 'country_of_issue', 'issuecountry', 'passportcountry', 'countryofissuance', 'documentcountry', 'issuingstate']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('passportIssuedCountry'), `${k} should classify as passportIssuedCountry (got ${buckets})`);
  }
});

// ---------------------------------------------------------------------------
// 13. Phone
// ---------------------------------------------------------------------------
test('phone keywords map to phone', () => {
  for (const k of ['phone', 'telephone', 'mobile', 'cellphone', 'cell_phone', 'phonenumber', 'tel', 'contactphone', 'mobile_phone', 'daytimephone', 'homephone', 'workphone', 'eveningphone']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('phone'), `${k} should classify as phone (got ${buckets})`);
  }
});

test('autocomplete tel variants map to phone', () => {
  for (const v of ['tel', 'tel-national', 'tel-country-code', 'tel-area-code', 'tel-local']) {
    assert.equal(autocompleteBucket(v), 'phone');
  }
});

// ---------------------------------------------------------------------------
// 14. Email
// ---------------------------------------------------------------------------
test('email keywords map to email', () => {
  for (const k of ['email', 'e-mail', 'emailaddress', 'email_address', 'mail', 'contactemail', 'contact_email', 'e_mail']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('email'), `${k} should classify as email (got ${buckets})`);
  }
});

test('autocomplete "email" maps to email', () => {
  assert.equal(autocompleteBucket('email'), 'email');
});

// ---------------------------------------------------------------------------
// Specific-name suppression: a bare "name" must not claim first/last/middle.
// (See "Recommended Matching Strategy": when first+last exist, split; a bare
// "name" means full name.)
// ---------------------------------------------------------------------------
test('first/last/middle name fields do NOT also classify as fullName', () => {
  for (const k of ['first_name', 'last_name', 'middle_name', 'given_name', 'family_name']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('firstName') || buckets.includes('lastName') || buckets.includes('middleName'),
      `${k} should be a specific name bucket (got ${buckets})`);
    assert.ok(!buckets.includes('fullName'), `${k} should NOT classify as fullName (got ${buckets})`);
  }
});

test('a bare "name" field classifies as fullName', () => {
  assert.ok(nameClass('name').includes('fullName'));
  assert.ok(nameClass('passenger_1_name').includes('fullName'));
  assert.ok(nameClass('guest_name').includes('fullName'));
});

// ---------------------------------------------------------------------------
// Passenger indexing / multi-passenger matching
// ---------------------------------------------------------------------------
test('extractPassengerNum parses prefixed and bracket numbering', () => {
  assert.equal(extractPassengerNum('passenger1_name'), 1);
  assert.equal(extractPassengerNum('passenger_2_name'), 2);
  assert.equal(extractPassengerNum('pax3_name'), 3);
  assert.equal(extractPassengerNum('traveler_4_passport'), 4);
  assert.equal(extractPassengerNum('guest5_name'), 5);
  assert.equal(extractPassengerNum('adult6_name'), 6);
  assert.equal(extractPassengerNum('Travelers[0].FirstName'), 0);
  assert.equal(extractPassengerNum('travelers[1].passportNumber'), 1);
  assert.equal(extractPassengerNum('phone'), null);
  assert.equal(extractPassengerNum('email'), null);
});

test('detectOffset distinguishes 0-based and 1-based forms', () => {
  assert.equal(detectOffset([0, 1, 2]), 0);
  assert.equal(detectOffset([1, 2, 3]), 1);
  assert.equal(detectOffset([]), null);
  assert.equal(detectOffset(null), null);
});

test('single-passenger form assigns shared fields to passenger 0', () => {
  const fields = [
    { attrs: 'full_name' },
    { attrs: 'phone' },
    { attrs: 'email' }
  ];
  const { assignments } = assignFields(fields, 1);
  assert.deepEqual(assignments[0].fullName, [0]);
  assert.deepEqual(assignments[0].phone, [1]);
  assert.deepEqual(assignments[0].email, [2]);
});

test('1-based passenger form maps passenger1..passenger2 to profiles 0..1', () => {
  const fields = [
    { attrs: 'passenger1_first_name', autocomplete: 'given-name' },
    { attrs: 'passenger1_last_name', autocomplete: 'family-name' },
    { attrs: 'passenger2_first_name', autocomplete: 'given-name' },
    { attrs: 'passenger2_last_name', autocomplete: 'family-name' },
    { attrs: 'phone' } // shared -> first passenger
  ];
  const { offset, assignments } = assignFields(fields, 2);
  assert.equal(offset, 1);
  assert.deepEqual(assignments[0].firstName, [0]);
  assert.deepEqual(assignments[0].lastName, [1]);
  assert.deepEqual(assignments[1].firstName, [2]);
  assert.deepEqual(assignments[1].lastName, [3]);
  assert.deepEqual(assignments[0].phone, [4]);
  assert.deepEqual(assignments[1].phone, []);
});

test('0-based bracket form maps [0],[1] to profiles 0..1', () => {
  const fields = [
    { attrs: 'travelers[0].firstName' },
    { attrs: 'travelers[0].passportNumber' },
    { attrs: 'travelers[1].firstName' },
    { attrs: 'travelers[1].passportNumber' }
  ];
  const { offset, assignments } = assignFields(fields, 2);
  assert.equal(offset, 0);
  assert.deepEqual(assignments[0].firstName, [0]);
  assert.deepEqual(assignments[0].passport, [1]);
  assert.deepEqual(assignments[1].firstName, [2]);
  assert.deepEqual(assignments[1].passport, [3]);
});

test('out-of-range passenger numbers are ignored', () => {
  const fields = [
    { attrs: 'passenger3_first_name' }
  ];
  const { assignments } = assignFields(fields, 1);
  assert.deepEqual(assignments[0].firstName, []);
});

test('every documented profile bucket is recognized', () => {
  for (const b of matcher.BUCKETS) {
    assert.ok(matcher.patterns[b], `missing patterns for bucket ${b}`);
    assert.ok(matcher.patterns[b].length > 0, `empty patterns for bucket ${b}`);
  }
});

test('patterns are unique within each bucket', () => {
  for (const b of matcher.BUCKETS) {
    const seen = new Set();
    for (const k of matcher.patterns[b]) {
      assert.ok(!seen.has(k), `duplicate pattern "${k}" in ${b}`);
      seen.add(k);
    }
  }
});

// ---------------------------------------------------------------------------
// 15. Nationality / country select value matching
// ---------------------------------------------------------------------------
// A stored nationality may be a 2-letter code ("US") or a full country name
// ("United States"). The dropdown may expose codes, full names, or both, so
// filling must translate between the two representations.

test('countryCode resolves codes and full names to an ISO code', () => {
  const { countryCode } = matcher;
  assert.equal(countryCode('US'), 'us');
  assert.equal(countryCode('us'), 'us');
  assert.equal(countryCode('USA'), 'us');
  assert.equal(countryCode('United States'), 'us');
  assert.equal(countryCode('United States of America'), 'us');
  assert.equal(countryCode('GB'), 'gb');
  assert.equal(countryCode('UK'), 'gb');
  assert.equal(countryCode('United Kingdom'), 'gb');
  assert.equal(countryCode('Germany'), 'de');
  assert.equal(countryCode('France'), 'fr');
  assert.equal(countryCode('Russia'), 'ru');
  assert.equal(countryCode('Uzbekistan'), 'uz');
  assert.equal(countryCode(''), null);
  assert.equal(countryCode(null), null);
  assert.equal(countryCode('Atlantis'), null);
});

test('matchSelectOption picks the exact option value match first', () => {
  const { matchSelectOption } = matcher;
  const options = [
    { text: 'Choose', value: '' },
    { text: 'United States', value: 'US' },
    { text: 'United Kingdom', value: 'GB' },
    { text: 'Germany', value: 'DE' }
  ];
  assert.equal(matchSelectOption(options, 'US'), 'US');
  assert.equal(matchSelectOption(options, 'gb'), 'GB');
});

test('matchSelectOption matches a full country name against its option text', () => {
  const { matchSelectOption } = matcher;
  const options = [
    { text: 'Choose', value: '' },
    { text: 'United States', value: 'US' },
    { text: 'United Kingdom', value: 'GB' }
  ];
  assert.equal(matchSelectOption(options, 'United States'), 'US');
  assert.equal(matchSelectOption(options, 'United Kingdom'), 'GB');
});

test('matchSelectOption translates a full country name onto code-only options (the reported bug)', () => {
  const { matchSelectOption } = matcher;
  const codeOnly = [
    { text: 'Choose', value: '' },
    { text: 'US', value: 'US' },
    { text: 'GB', value: 'GB' },
    { text: 'DE', value: 'DE' },
    { text: 'FR', value: 'FR' },
    { text: 'CA', value: 'CA' }
  ];
  assert.equal(matchSelectOption(codeOnly, 'United States'), 'US');
  assert.equal(matchSelectOption(codeOnly, 'USA'), 'US');
  assert.equal(matchSelectOption(codeOnly, 'Germany'), 'DE');
  assert.equal(matchSelectOption(codeOnly, 'United Kingdom'), 'GB');
});

test('matchSelectOption returns the option value for a code even for state-property options', () => {
  const { matchSelectOption } = matcher;
  const options = [
    { text: 'Alabama', value: 'AL' },
    { text: 'California', value: 'CA' },
    { text: 'United States', value: 'US' }
  ];
  assert.equal(matchSelectOption(options, 'United States'), 'US');
});

test('issuing-country selects translate full country names onto code-only options (same rules as nationality)', () => {
  const { matchSelectOption } = matcher;
  const codeOnly = [
    { text: 'Choose', value: '' },
    { text: 'US', value: 'US' },
    { text: 'GB', value: 'GB' },
    { text: 'DE', value: 'DE' },
    { text: 'FR', value: 'FR' },
    { text: 'CA', value: 'CA' }
  ];
  assert.equal(matchSelectOption(codeOnly, 'United States of America'), 'US');
  assert.equal(matchSelectOption(codeOnly, 'United Kingdom'), 'GB');
  assert.equal(matchSelectOption(codeOnly, 'France'), 'FR');
  assert.equal(matchSelectOption(codeOnly, 'Canada'), 'CA');
});

test('matchSelectOption leaves non-countries and empties unmatched', () => {
  const { matchSelectOption } = matcher;
  const options = [
    { text: 'Choose', value: '' },
    { text: 'US', value: 'US' },
    { text: 'GB', value: 'GB' }
  ];
  assert.equal(matchSelectOption(options, ''), null);
  assert.equal(matchSelectOption(options, null), null);
  assert.equal(matchSelectOption(options, 'Atlantis'), null);
  assert.equal(matchSelectOption([], 'US'), null);
});

// A nationality / issuing-country field must not also be claimed by the full
// name bucket just because "Country name" contains the token "name" — otherwise
// the full name would be written into the country dropdown first.
test('nationality and issuing-country fields do NOT also classify as fullName', () => {
  for (const k of ['nationality', 'pax1_nationality', 'guest3_nationality', 'issuing_country', 'country_of_issue']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('nationality') || buckets.includes('passportIssuedCountry'),
      `${k} should be a country bucket (got ${buckets})`);
    assert.ok(!buckets.includes('fullName'), `${k} should NOT classify as fullName (got ${buckets})`);
  }
});

test('country-name autocomplete maps to nationality and never to fullName', () => {
  const buckets = nameClass('nationality', 'country-name');
  assert.ok(buckets.includes('nationality'));
  assert.ok(!buckets.includes('fullName'));
});

// ---------------------------------------------------------------------------
// Regression: passport sub-fields must not be claimed by the passport-number
// bucket, and the issue-date vs issuing-country ambiguity must resolve to the
// country intent. (See "passport_issued_at before passport_number" ordering bug.)
// ---------------------------------------------------------------------------
test('passport issue/expiry/country fields do NOT classify as the passport number bucket', () => {
  for (const k of ['passport_issued_at', 'passport_expires_at', 'passport_country', 'passport_issued_country', 'passport_expiry']) {
    const buckets = nameClass(k);
    assert.ok(!buckets.includes('passport'), `${k} should NOT classify as passport (got ${buckets})`);
  }
});

test('passport_issued_at / passport_expires_at classify to their own buckets', () => {
  const issued = nameClass('passport_issued_at');
  assert.ok(issued.includes('passportIssuedAt'));
  const expires = nameClass('passport_expires_at');
  assert.ok(expires.includes('passportExpiresAt'));
});

test('bare "passport" and explicit passport number forms still match', () => {
  assert.ok(nameClass('guest3_passport').includes('passport'));
  assert.ok(nameClass('passport_number').includes('passport'));
  assert.ok(nameClass('passportNumber').includes('passport'));
});

test('assignFields keeps passport number/issue/expiry in separate buckets regardless of DOM order', () => {
  // issue date appears BEFORE the number field, which previously misrouted the
  // number into the date input and skipped the real passport field.
  const fields = [
    { attrs: 'passenger1_passport_issued_at' },
    { attrs: 'passenger1_passport_number' },
    { attrs: 'passenger1_passport_expires_at' }
  ];
  const { assignments } = assignFields(fields, 1);
  assert.deepEqual(assignments[0].passport, [1]);
  assert.deepEqual(assignments[0].passportIssuedAt, [0]);
  assert.deepEqual(assignments[0].passportExpiresAt, [2]);
});

test('country_of_issue / issuecountry classify as issuing country, not issue date', () => {
  for (const k of ['country_of_issue', 'issuecountry', 'issuing_country', 'passport_issued_country']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('passportIssuedCountry'), `${k} should classify as passportIssuedCountry (got ${buckets})`);
    assert.ok(!buckets.includes('passportIssuedAt'), `${k} should NOT classify as passportIssuedAt (got ${buckets})`);
  }
});

test('pure issue-date keywords still classify as passportIssuedAt', () => {
  for (const k of ['issue_date', 'dateissued', 'passportissuedate', 'passport_issued_at']) {
    const buckets = nameClass(k);
    assert.ok(buckets.includes('passportIssuedAt'), `${k} should classify as passportIssuedAt (got ${buckets})`);
  }
});

test('non-person "name" fields do NOT classify as fullName', () => {
  for (const k of ['company_name', 'airline_name', 'cardholder_name', 'customer_name', 'organization_name', 'bank_name']) {
    const buckets = nameClass(k);
    assert.ok(!buckets.includes('fullName'), `${k} should NOT classify as fullName (got ${buckets})`);
  }
  assert.ok(nameClass('full name').includes('fullName'));
  assert.ok(nameClass('passenger name').includes('fullName'));
});

