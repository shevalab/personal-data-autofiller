/*
 * matcher.js — the field-matching engine for the Personal Data Autofiller.
 *
 * This file is the single source of truth for the "which input field maps to
 * which profile bucket" rules described in `personal-data-form-fields.md`.
 *
 * It is written as a UMD module so it can be:
 *   - `require()`d by the Node.js unit tests (test/matcher.test.js), and
 *   - loaded as a plain <script> in the extension's content script (see
 *     manifest.json), where content.js uses it to fill forms.
 *
 * The engine is deliberately pure and DOM-free: it operates on a normalized
 * attribute string and returns simple data structures. The DOM work (reading
 * real fields, setting values) lives in the content script (content.js).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.PersonalDataAutofillerMatcher = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * buildEngine() — returns the matcher object. Keeping every constant and
   * helper inside this one function means its `toString()` is the complete,
   * self-contained engine source that autofill injection needs.
   */
  function buildEngine() {
    // -------------------------------------------------------------------------
    // Keyword lists per profile bucket. Derived from personal-data-form-fields.md.
    // Matching is case-insensitive after normalizing spaces / _ / -.
    // -------------------------------------------------------------------------
    var patterns = {
      title: [
        'title', 'prefix', 'honorific', 'honorificprefix', 'honorific-prefix',
        'mr', 'mrs', 'ms', 'miss', 'dr',
        'suffix', 'honorificsuffix', 'honorific-suffix', 'jr', 'sr', 'ii', 'iii'
      ],
      gender: [
        'gender', 'sex', 'genderaslisted', 'gender_as_listed', 'sexaslisted',
        'passenger gender'
      ],
      fullName: [
        'name', 'fullname', 'full_name', 'full-name', 'full name',
        'passengername', 'passenger_name', 'passenger-name', 'travelername',
        'traveler_name', 'traveler-name', 'travellername', 'traveller_name',
        'traveller-name', 'passportname', 'passport_name', 'passport-name',
        'nameonpassport', 'legalname', 'legal_name', 'completename',
        'yourname', 'your_name', 'passengerfullname', 'passenger_full_name',
        'guestname', 'guest_name', 'applicantname', 'applicant_name',
        'paxname', 'pax_name'
      ],
      firstName: [
        'firstname', 'first_name', 'first-name', 'first name', 'fname',
        'f-name', 'firstn', 'givenname', 'given_name', 'given-name',
        'given names', 'givenname(s)', 'forename', 'forenames', 'prenom',
        'christianname', 'christian_name', 'givenname2', 'given_name_2',
        'firstname2', 'first_name_2', 'forename2'
      ],
      lastName: [
        'lastname', 'last_name', 'last-name', 'last name', 'lname', 'l-name',
        'lastn', 'surname', 'familyname', 'family_name', 'family-name',
        'family name', 's-name', 'secondname', 'second_name', 'fathername',
        'father_name', 'mothername', 'mother_name', 'secondsurname',
        'second_surname', 'lastname2', 'last_name_2'
      ],
      middleName: [
        'middlename', 'middle_name', 'middle-name', 'middle name', 'mname',
        'm-name', 'additionalname', 'additional_name', 'additional-name',
        'middleinitial', 'middle_initial', 'middle-initial',
        'middlenameinitial'
      ],
      passport: [
        'passport', 'passportnumber', 'passport_number', 'passport-number',
        'passport no', 'passportid', 'passport_id', 'passport-id',
        'passportnum', 'passport_num', 'documentnumber', 'document_number',
        'document-number', 'docnumber', 'doc_number', 'documentno',
        'document_no', 'traveldocumentnumber', 'travel document number',
        'idnumber', 'id_number', 'id-number', 'identitynumber',
        'identity_number', 'docnum', 'documentid', 'document_id',
        'docno', 'doc_no'
      ],
      passportIssuedAt: [
        'issuedate', 'issue_date', 'issue-date', 'dateofissue',
        'date_of_issue', 'passportissuedate', 'passport_issue_date',
        'passportissue', 'issued on', 'dateissued', 'date_issued',
        'issued', 'issuedat', 'issue', 'dateofissuance', 'date_of_issuance',
        'passportissueddate', 'passport_issued_date', 'docissuedate',
        'documentissuedate', 'document_issue_date'
      ],
      passportExpiresAt: [
        'expiry', 'expirydate', 'expiry_date', 'expiry-date', 'expiration',
        'expirationdate', 'expiration_date', 'expiration-date', 'expiredate',
        'expire_date', 'expires', 'passportexpiry', 'passport_expiry',
        'passportexpiration', 'passport_expiration', 'validuntil',
        'valid_until', 'validto', 'valid_to', 'documentexpiry',
        'document_expiry', 'validthrough', 'valid_through'
      ],
      passportIssuedCountry: [
        'issuingcountry', 'issuing_country', 'issuing country',
        'countryofissue', 'country_of_issue', 'country of issue',
        'issuecountry', 'issue_country', 'passportcountry',
        'passport_country', 'passportissuedcountry', 'passport_issued_country',
        'passport issuing country', 'countryofissuance', 'documentcountry',
        'issuingstate', 'issuingauthority', 'issuing_authority',
        'placeofissue', 'place_of_issue'
      ],
      dob: [
        'dob', 'dateofbirth', 'date_of_birth', 'date-of-birth', 'birthdate',
        'birth_date', 'birth-date', 'birthday', 'birth_day', 'birth-day',
        'bday', 'passengerdob', 'passenger_dob', 'travelerdob',
        'date born', 'born', 'birthmonth', 'birth_month', 'birthyear',
        'birth_year', 'birthdate2', 'birth_date_2', 'dateofbirth2'
      ],
      phone: [
        'phone', 'telephone', 'mobile', 'cellphone', 'cell_phone',
        'cell-phone', 'phonenumber', 'phone_number', 'phone-number', 'tel',
        'contactphone', 'contact_phone', 'mobilephone', 'mobile_phone',
        'daytimephone', 'homephone', 'workphone', 'businessphone',
        'eveningphone', 'contactnumber', 'contact_number', 'primarycontact',
        'phone2', 'phone_2', 'telephone2'
      ],
      email: [
        'email', 'e-mail', 'emailaddress', 'email_address', 'email-address',
        'mail', 'contactemail', 'contact_email', 'e_mail',
        'correspondenceemail', 'correspondence_email', 'primaryemail',
        'primary_email', 'secondaryemail', 'secondary_email', 'email2',
        'email_2', 'contactemail2'
      ],
      nationality: [
        'nationality', 'citizenship', 'countryofcitizenship',
        'country_of_citizenship', 'nationalitycode', 'citizen',
        'citizenshipcountry', 'countryofnationality', 'passportnationality',
        'nationality country', 'country of citizenship', 'nationality2',
        'nationality_2', 'citizenship2', 'citizenship_2'
      ]
    };

    /**
     * Optional structural matching rules (regular expressions). Unlike the
     * keyword tables (which match whole tokens), these express relationships
     * the token approach cannot: "passport NOT followed by issue/expiry/country",
     * "country_of_issue is an issuing country, not an issue date", and
     * "company_name is not a person's full name".
     *
     * Rules are applied AFTER keyword matching, in order, against the
     * normalized attribute text (see `normalizeAttr`). Each rule is one of:
     *   { re, add: 'bucket' }    -> on match, add the bucket (positive)
     *   { re, remove: 'bucket' } -> on match, remove the bucket (suppressor)
     */
    var patternRe = {
      passport: [
        { re: /passport\s*(?:issued|issue|expir|expiration|valid|country|nationality)/i, remove: 'passport' }
      ],
      passportIssuedAt: [
        { re: /\b(?:issuing|issue|issued)\s*(?:country|nationality)|\bcountry\s+(?:of\s+)?issue\b|issuecountry|\bplace\s+of\s+issue\b/i, remove: 'passportIssuedAt' }
      ],
      fullName: [
        { re: /\b(?:company|airline|cardholder|customer|organization|organisation|business|agency|employer|institution|bank|school|website|domain|account|file|brand)\s+name\b/i, remove: 'fullName' }
      ]
    };

    /**
     * Apply patternRe rules to the bucket set; mutates `buckets` in place.
     * @param {string} attrs raw attribute text (normalized internally)
     * @param {string[]} buckets bucket array to mutate
     * @param {Object} [rules] ruleset; defaults to the engine's `patternRe`
     * @returns {string[]} the same `buckets` array
     */
    function applyPatternRe(attrs, buckets, rules) {
      var n = normalizeAttr(attrs);
      rules = rules || patternRe;
      for (var key in rules) {
        if (!Object.prototype.hasOwnProperty.call(rules, key)) continue;
        rules[key].forEach(function (rule) {
          if (!rule.re.test(n)) return;
          if (rule.add) {
            if (buckets.indexOf(rule.add) === -1) buckets.push(rule.add);
          } else if (rule.remove) {
            var idx = buckets.indexOf(rule.remove);
            if (idx !== -1) buckets.splice(idx, 1);
          }
        });
      }
      return buckets;
    }

    var BUCKETS = [
      'title', 'gender', 'fullName', 'firstName', 'lastName', 'middleName',
      'passport', 'passportIssuedAt', 'passportExpiresAt',
      'passportIssuedCountry', 'dob', 'phone', 'email', 'nationality'
    ];

    // High-reliability mapping from the HTML `autocomplete` attribute to a
    // profile bucket. Checked before keyword matching (see the reference doc).
    var autocompleteMap = {
      'name': 'fullName',
      'given-name': 'firstName',
      'family-name': 'lastName',
      'additional-name': 'middleName',
      'honorific-prefix': 'title',
      'honorific-suffix': 'title',
      'sex': 'gender',
      'bday': 'dob',
      'bday-day': 'dob',
      'bday-month': 'dob',
      'bday-year': 'dob',
      'tel': 'phone',
      'tel-national': 'phone',
      'tel-country-code': 'phone',
      'tel-area-code': 'phone',
      'tel-local': 'phone',
      'email': 'email',
      'country-name': 'nationality',
      'country': 'nationality'
    };

    // ISO 3166-1 alpha-2 code lookup by English country name (+ common aliases).
    // Lets a stored nationality such as "United States" be written into a
    // dropdown that only exposes 2-letter codes ("US"). Keys are pre-normalized
    // (lowercase, separators stripped); values are the lowercase country code.
    var countryAliases = {
      'ad': 'ad',
      'ae': 'ae',
      'af': 'af',
      'afghanistan': 'af',
      'ag': 'ag',
      'ai': 'ai',
      'al': 'al',
      'ålandislands': 'ax',
      'albania': 'al',
      'algeria': 'dz',
      'am': 'am',
      'america': 'us',
      'americansamoa': 'as',
      'andorra': 'ad',
      'angola': 'ao',
      'anguilla': 'ai',
      'antarctica': 'aq',
      'antigua': 'ag',
      'antiguaandbarbuda': 'ag',
      'ao': 'ao',
      'aq': 'aq',
      'ar': 'ar',
      'arabrepublicofegypt': 'eg',
      'argentina': 'ar',
      'argentinerepublic': 'ar',
      'armenia': 'am',
      'aruba': 'aw',
      'as': 'as',
      'at': 'at',
      'au': 'au',
      'australia': 'au',
      'austria': 'at',
      'aw': 'aw',
      'ax': 'ax',
      'az': 'az',
      'azerbaijan': 'az',
      'ba': 'ba',
      'bahamas': 'bs',
      'bahrain': 'bh',
      'bailiwickofguernsey': 'gg',
      'bailiwickofjersey': 'je',
      'bangladesh': 'bd',
      'barbados': 'bb',
      'bb': 'bb',
      'bd': 'bd',
      'be': 'be',
      'belarus': 'by',
      'belgium': 'be',
      'belize': 'bz',
      'benin': 'bj',
      'bermuda': 'bm',
      'bf': 'bf',
      'bg': 'bg',
      'bh': 'bh',
      'bhutan': 'bt',
      'bi': 'bi',
      'bj': 'bj',
      'bl': 'bl',
      'bm': 'bm',
      'bn': 'bn',
      'bo': 'bo',
      'bolivarianrepublicofvenezuela': 've',
      'bolivia': 'bo',
      'bonairesinteustatiusandsaba': 'bq',
      'bosniaandherzegovina': 'ba',
      'botswana': 'bw',
      'bouvetisland': 'bv',
      'bq': 'bq',
      'br': 'br',
      'brazil': 'br',
      'britain': 'gb',
      'britishindianoceanterritory': 'io',
      'britishvirginislands': 'vg',
      'brunei': 'bn',
      'bs': 'bs',
      'bt': 'bt',
      'bulgaria': 'bg',
      'burkinafaso': 'bf',
      'burma': 'mm',
      'burundi': 'bi',
      'bv': 'bv',
      'bw': 'bw',
      'by': 'by',
      'bz': 'bz',
      'ca': 'ca',
      'cambodia': 'kh',
      'cameroon': 'cm',
      'canada': 'ca',
      'capeverde': 'cv',
      'caribbeannetherlands': 'bq',
      'caymanislands': 'ky',
      'cc': 'cc',
      'cd': 'cd',
      'centralafricanrepublic': 'cf',
      'cf': 'cf',
      'cg': 'cg',
      'ch': 'ch',
      'chad': 'td',
      'chile': 'cl',
      'china': 'cn',
      'christmasisland': 'cx',
      'ci': 'ci',
      'ck': 'ck',
      'cl': 'cl',
      'cm': 'cm',
      'cn': 'cn',
      'co': 'co',
      'cocoskeelingislands': 'cc',
      'collectivityofsaintbarthélemy': 'bl',
      'colombia': 'co',
      'commonwealthofaustralia': 'au',
      'commonwealthofdominica': 'dm',
      'commonwealthofpuertorico': 'pr',
      'commonwealthofthebahamas': 'bs',
      'commonwealthofthenorthernmarianaislands': 'mp',
      'comoros': 'km',
      'congo': 'cd',
      'congobrazzaville': 'cg',
      'cookislands': 'ck',
      'cooperativerepublicofguyana': 'gy',
      'costarica': 'cr',
      'cotedivoire': 'ci',
      'countryofcuraçao': 'cw',
      'cr': 'cr',
      'croatia': 'hr',
      'cu': 'cu',
      'cuba': 'cu',
      'curaçao': 'cw',
      'cv': 'cv',
      'cw': 'cw',
      'cx': 'cx',
      'cy': 'cy',
      'cyprus': 'cy',
      'cz': 'cz',
      'czechia': 'cz',
      'czechrepub': 'cz',
      'czechrepublic': 'cz',
      'de': 'de',
      'democraticpeoplesrepublicofkorea': 'kp',
      'democraticrepublicofsãotoméandpríncipe': 'st',
      'democraticrepublicofthecongo': 'cd',
      'democraticrepublicoftimorleste': 'tl',
      'democraticsocialistrepublicofsrilanka': 'lk',
      'denmark': 'dk',
      'departmentofmayotte': 'yt',
      'dj': 'dj',
      'djibouti': 'dj',
      'dk': 'dk',
      'dm': 'dm',
      'do': 'do',
      'dominica': 'dm',
      'dominicanrepublic': 'do',
      'drccongo': 'cd',
      'drcongo': 'cd',
      'dz': 'dz',
      'easttimor': 'tl',
      'ec': 'ec',
      'ecuador': 'ec',
      'ee': 'ee',
      'eg': 'eg',
      'egypt': 'eg',
      'eh': 'eh',
      'elsalvador': 'sv',
      'england': 'gb',
      'equatorialguinea': 'gq',
      'er': 'er',
      'eritrea': 'er',
      'es': 'es',
      'estonia': 'ee',
      'eswatini': 'sz',
      'et': 'et',
      'ethiopia': 'et',
      'falklandislands': 'fk',
      'faroeislands': 'fo',
      'federaldemocraticrepublicofethiopia': 'et',
      'federaldemocraticrepublicofnepal': 'np',
      'federalrepublicofgermany': 'de',
      'federalrepublicofnigeria': 'ng',
      'federalrepublicofsomalia': 'so',
      'federatedstatesofmicronesia': 'fm',
      'federationofsaintchristopherandnevis': 'kn',
      'federativerepublicofbrazil': 'br',
      'fi': 'fi',
      'fiji': 'fj',
      'finland': 'fi',
      'fj': 'fj',
      'fk': 'fk',
      'fm': 'fm',
      'fo': 'fo',
      'fr': 'fr',
      'france': 'fr',
      'frenchguiana': 'gf',
      'frenchpolynesia': 'pf',
      'frenchrepublic': 'fr',
      'frenchsouthernandantarcticlands': 'tf',
      'ga': 'ga',
      'gabon': 'ga',
      'gaboneserepublic': 'ga',
      'gambia': 'gm',
      'gb': 'gb',
      'gd': 'gd',
      'ge': 'ge',
      'georgia': 'ge',
      'germany': 'de',
      'gf': 'gf',
      'gg': 'gg',
      'gh': 'gh',
      'ghana': 'gh',
      'gi': 'gi',
      'gibraltar': 'gi',
      'gl': 'gl',
      'gm': 'gm',
      'gn': 'gn',
      'gp': 'gp',
      'gq': 'gq',
      'gr': 'gr',
      'grandduchyofluxembourg': 'lu',
      'greatbritain': 'gb',
      'greece': 'gr',
      'greenland': 'gl',
      'grenada': 'gd',
      'gs': 'gs',
      'gt': 'gt',
      'gu': 'gu',
      'guadeloupe': 'gp',
      'guam': 'gu',
      'guatemala': 'gt',
      'guernsey': 'gg',
      'guiana': 'gf',
      'guinea': 'gn',
      'guineabissau': 'gw',
      'guyana': 'gy',
      'gw': 'gw',
      'gy': 'gy',
      'haiti': 'ht',
      'hashemitekingdomofjordan': 'jo',
      'heardislandandmcdonaldislands': 'hm',
      'hellenicrepublic': 'gr',
      'hk': 'hk',
      'hm': 'hm',
      'hn': 'hn',
      'honduras': 'hn',
      'hongkong': 'hk',
      'hongkongspecialadministrativeregionofthepeoplesrepublicofchina': 'hk',
      'hr': 'hr',
      'ht': 'ht',
      'hu': 'hu',
      'hungary': 'hu',
      'iceland': 'is',
      'id': 'id',
      'ie': 'ie',
      'il': 'il',
      'im': 'im',
      'in': 'in',
      'independentandsovereignrepublicofkiribati': 'ki',
      'independentstateofpapuanewguinea': 'pg',
      'independentstateofsamoa': 'ws',
      'india': 'in',
      'indonesia': 'id',
      'io': 'io',
      'iq': 'iq',
      'ir': 'ir',
      'iran': 'ir',
      'iraq': 'iq',
      'ireland': 'ie',
      'is': 'is',
      'islamicrepublicofafghanistan': 'af',
      'islamicrepublicofiran': 'ir',
      'islamicrepublicofmauritania': 'mr',
      'islamicrepublicofpakistan': 'pk',
      'isleofman': 'im',
      'israel': 'il',
      'it': 'it',
      'italianrepublic': 'it',
      'italy': 'it',
      'ivorycoast': 'ci',
      'jamaica': 'jm',
      'japan': 'jp',
      'je': 'je',
      'jersey': 'je',
      'jm': 'jm',
      'jo': 'jo',
      'jordan': 'jo',
      'jp': 'jp',
      'kazakhstan': 'kz',
      'ke': 'ke',
      'kenya': 'ke',
      'kg': 'kg',
      'kh': 'kh',
      'ki': 'ki',
      'kingdomofbahrain': 'bh',
      'kingdomofbelgium': 'be',
      'kingdomofbhutan': 'bt',
      'kingdomofcambodia': 'kh',
      'kingdomofdenmark': 'dk',
      'kingdomofeswatini': 'sz',
      'kingdomoflesotho': 'ls',
      'kingdomofmorocco': 'ma',
      'kingdomofnorway': 'no',
      'kingdomofsaudiarabia': 'sa',
      'kingdomofspain': 'es',
      'kingdomofsweden': 'se',
      'kingdomofthailand': 'th',
      'kingdomofthenetherlands': 'nl',
      'kingdomoftonga': 'to',
      'kiribati': 'ki',
      'km': 'km',
      'kn': 'kn',
      'korea': 'kr',
      'kosovo': 'xk',
      'kp': 'kp',
      'kr': 'kr',
      'kuwait': 'kw',
      'kw': 'kw',
      'ky': 'ky',
      'kyrgyzrepublic': 'kg',
      'kyrgyzstan': 'kg',
      'kz': 'kz',
      'la': 'la',
      'laopeoplesdemocraticrepublic': 'la',
      'laos': 'la',
      'latvia': 'lv',
      'lb': 'lb',
      'lc': 'lc',
      'lebaneserepublic': 'lb',
      'lebanon': 'lb',
      'lesotho': 'ls',
      'li': 'li',
      'liberia': 'lr',
      'libya': 'ly',
      'liechtenstein': 'li',
      'lithuania': 'lt',
      'lk': 'lk',
      'lr': 'lr',
      'ls': 'ls',
      'lt': 'lt',
      'lu': 'lu',
      'luxembourg': 'lu',
      'lv': 'lv',
      'ly': 'ly',
      'ma': 'ma',
      'macaospecialadministrativeregionofthepeoplesrepublicofchina': 'mo',
      'macau': 'mo',
      'madagascar': 'mg',
      'malawi': 'mw',
      'malaysia': 'my',
      'maldives': 'mv',
      'mali': 'ml',
      'malta': 'mt',
      'marshallislands': 'mh',
      'martinique': 'mq',
      'mauritania': 'mr',
      'mauritius': 'mu',
      'mayotte': 'yt',
      'mc': 'mc',
      'md': 'md',
      'me': 'me',
      'mexico': 'mx',
      'mf': 'mf',
      'mg': 'mg',
      'mh': 'mh',
      'micronesia': 'fm',
      'mk': 'mk',
      'ml': 'ml',
      'mm': 'mm',
      'mn': 'mn',
      'mo': 'mo',
      'moldova': 'md',
      'monaco': 'mc',
      'mongolia': 'mn',
      'montenegro': 'me',
      'montserrat': 'ms',
      'morocco': 'ma',
      'mostserenerepublicofsanmarino': 'sm',
      'mozambique': 'mz',
      'mp': 'mp',
      'mq': 'mq',
      'mr': 'mr',
      'ms': 'ms',
      'mt': 'mt',
      'mu': 'mu',
      'mv': 'mv',
      'mw': 'mw',
      'mx': 'mx',
      'my': 'my',
      'myanmar': 'mm',
      'mz': 'mz',
      'na': 'na',
      'namibia': 'na',
      'nationofbruneiabodeofpeace': 'bn',
      'nauru': 'nr',
      'nc': 'nc',
      'ne': 'ne',
      'nepal': 'np',
      'netherlands': 'nl',
      'newcaledonia': 'nc',
      'newzealand': 'nz',
      'nf': 'nf',
      'ng': 'ng',
      'ni': 'ni',
      'nicaragua': 'ni',
      'niger': 'ne',
      'nigeria': 'ng',
      'niue': 'nu',
      'nl': 'nl',
      'no': 'no',
      'norfolkisland': 'nf',
      'northernmarianaislands': 'mp',
      'northkorea': 'kp',
      'northmacedonia': 'mk',
      'norway': 'no',
      'np': 'np',
      'nr': 'nr',
      'nu': 'nu',
      'nz': 'nz',
      'om': 'om',
      'oman': 'om',
      'orientalrepublicofuruguay': 'uy',
      'pa': 'pa',
      'pakistan': 'pk',
      'palau': 'pw',
      'palestine': 'ps',
      'panama': 'pa',
      'papuanewguinea': 'pg',
      'paraguay': 'py',
      'pe': 'pe',
      'peoplesdemocraticrepublicofalgeria': 'dz',
      'peoplesrepublicofbangladesh': 'bd',
      'peoplesrepublicofchina': 'cn',
      'peru': 'pe',
      'pf': 'pf',
      'pg': 'pg',
      'ph': 'ph',
      'philippines': 'ph',
      'pitcairngroupofislands': 'pn',
      'pitcairnislands': 'pn',
      'pk': 'pk',
      'pl': 'pl',
      'plurinationalstateofbolivia': 'bo',
      'pm': 'pm',
      'pn': 'pn',
      'poland': 'pl',
      'portugal': 'pt',
      'portugueserepublic': 'pt',
      'pr': 'pr',
      'principalityofandorra': 'ad',
      'principalityofliechtenstein': 'li',
      'principalityofmonaco': 'mc',
      'ps': 'ps',
      'pt': 'pt',
      'puertorico': 'pr',
      'pw': 'pw',
      'py': 'py',
      'qa': 'qa',
      'qatar': 'qa',
      're': 're',
      'republicofalbania': 'al',
      'republicofangola': 'ao',
      'republicofarmenia': 'am',
      'republicofaustria': 'at',
      'republicofazerbaijan': 'az',
      'republicofbelarus': 'by',
      'republicofbenin': 'bj',
      'republicofbotswana': 'bw',
      'republicofbulgaria': 'bg',
      'republicofburundi': 'bi',
      'republicofcaboverde': 'cv',
      'republicofcameroon': 'cm',
      'republicofchad': 'td',
      'republicofchile': 'cl',
      'republicofchinataiwan': 'tw',
      'republicofcolombia': 'co',
      'republicofcostarica': 'cr',
      'republicofcôtedivoire': 'ci',
      'republicofcroatia': 'hr',
      'republicofcuba': 'cu',
      'republicofcyprus': 'cy',
      'republicofdjibouti': 'dj',
      'republicofecuador': 'ec',
      'republicofelsalvador': 'sv',
      'republicofequatorialguinea': 'gq',
      'republicofestonia': 'ee',
      'republicoffiji': 'fj',
      'republicoffinland': 'fi',
      'republicofghana': 'gh',
      'republicofguatemala': 'gt',
      'republicofguinea': 'gn',
      'republicofguineabissau': 'gw',
      'republicofhaiti': 'ht',
      'republicofhonduras': 'hn',
      'republicofindia': 'in',
      'republicofindonesia': 'id',
      'republicofiraq': 'iq',
      'republicofireland': 'ie',
      'republicofkazakhstan': 'kz',
      'republicofkenya': 'ke',
      'republicofkorea': 'kr',
      'republicofkosovo': 'xk',
      'republicoflatvia': 'lv',
      'republicofliberia': 'lr',
      'republicoflithuania': 'lt',
      'republicofmadagascar': 'mg',
      'republicofmalawi': 'mw',
      'republicofmali': 'ml',
      'republicofmalta': 'mt',
      'republicofmauritius': 'mu',
      'republicofmoldova': 'md',
      'republicofmozambique': 'mz',
      'republicofnamibia': 'na',
      'republicofnauru': 'nr',
      'republicofnicaragua': 'ni',
      'republicofniger': 'ne',
      'republicofnorthmacedonia': 'mk',
      'republicofpalau': 'pw',
      'republicofpanama': 'pa',
      'republicofparaguay': 'py',
      'republicofperu': 'pe',
      'republicofpoland': 'pl',
      'republicofrwanda': 'rw',
      'republicofsenegal': 'sn',
      'republicofserbia': 'rs',
      'republicofseychelles': 'sc',
      'republicofsierraleone': 'sl',
      'republicofsingapore': 'sg',
      'republicofslovenia': 'si',
      'republicofsouthafrica': 'za',
      'republicofsouthsudan': 'ss',
      'republicofsuriname': 'sr',
      'republicoftajikistan': 'tj',
      'republicofthecongo': 'cg',
      'republicofthegambia': 'gm',
      'republicofthemaldives': 'mv',
      'republicofthemarshallislands': 'mh',
      'republicofthephilippines': 'ph',
      'republicofthesudan': 'sd',
      'republicoftheunionofmyanmar': 'mm',
      'republicoftrinidadandtobago': 'tt',
      'republicoftürkiye': 'tr',
      'republicofuganda': 'ug',
      'republicofuzbekistan': 'uz',
      'republicofvanuatu': 'vu',
      'republicofyemen': 'ye',
      'republicofzambia': 'zm',
      'republicofzimbabwe': 'zw',
      'réunion': 're',
      'réunionisland': 're',
      'ro': 'ro',
      'romania': 'ro',
      'rs': 'rs',
      'ru': 'ru',
      'russia': 'ru',
      'russianfederation': 'ru',
      'rw': 'rw',
      'rwanda': 'rw',
      'sa': 'sa',
      'sahrawiarabdemocraticrepublic': 'eh',
      'saintbarthélemy': 'bl',
      'sainthelenaascensionandtristandacunha': 'sh',
      'saintkittsandnevis': 'kn',
      'saintlucia': 'lc',
      'saintmartin': 'mf',
      'saintpierreandmiquelon': 'pm',
      'saintvincentandthegrenadines': 'vc',
      'samoa': 'ws',
      'sanmarino': 'sm',
      'sãotoméandpríncipe': 'st',
      'saudiarabia': 'sa',
      'sb': 'sb',
      'sc': 'sc',
      'sd': 'sd',
      'se': 'se',
      'senegal': 'sn',
      'serbia': 'rs',
      'seychelles': 'sc',
      'sg': 'sg',
      'sh': 'sh',
      'si': 'si',
      'sierraleone': 'sl',
      'singapore': 'sg',
      'sintmaarten': 'sx',
      'sj': 'sj',
      'sk': 'sk',
      'sl': 'sl',
      'slovakia': 'sk',
      'slovakrepublic': 'sk',
      'slovenia': 'si',
      'sm': 'sm',
      'sn': 'sn',
      'so': 'so',
      'socialistrepublicofvietnam': 'vn',
      'solomonislands': 'sb',
      'somalia': 'so',
      'southafrica': 'za',
      'southgeorgia': 'gs',
      'southgeorgiaandthesouthsandwichislands': 'gs',
      'southkorea': 'kr',
      'southsudan': 'ss',
      'spain': 'es',
      'sr': 'sr',
      'srilanka': 'lk',
      'ss': 'ss',
      'st': 'st',
      'stateoferitrea': 'er',
      'stateofisrael': 'il',
      'stateofkuwait': 'kw',
      'stateoflibya': 'ly',
      'stateofpalestine': 'ps',
      'stateofqatar': 'qa',
      'sudan': 'sd',
      'sultanateofoman': 'om',
      'suriname': 'sr',
      'sv': 'sv',
      'svalbardandjanmayen': 'sj',
      'svalbardogjanmayen': 'sj',
      'swaziland': 'sz',
      'sweden': 'se',
      'swissconfederation': 'ch',
      'switzerland': 'ch',
      'sx': 'sx',
      'sy': 'sy',
      'syria': 'sy',
      'syrianarabrepublic': 'sy',
      'sz': 'sz',
      'taiwan': 'tw',
      'tajikistan': 'tj',
      'tanzania': 'tz',
      'turkiye': 'tr',
      'tc': 'tc',
      'td': 'td',
      'territoryofchristmasisland': 'cx',
      'territoryofnorfolkisland': 'nf',
      'territoryofthecocoskeelingislands': 'cc',
      'territoryofthefrenchsouthernandantarcticlands': 'tf',
      'territoryofthewallisandfutunaislands': 'wf',
      'tf': 'tf',
      'tg': 'tg',
      'th': 'th',
      'thailand': 'th',
      'thebahamas': 'bs',
      'thegambia': 'gm',
      'timorleste': 'tl',
      'tj': 'tj',
      'tk': 'tk',
      'tl': 'tl',
      'tm': 'tm',
      'tn': 'tn',
      'to': 'to',
      'togo': 'tg',
      'togoleserepublic': 'tg',
      'tokelau': 'tk',
      'tonga': 'to',
      'tr': 'tr',
      'trinidadandtobago': 'tt',
      'tt': 'tt',
      'tunisia': 'tn',
      'tunisianrepublic': 'tn',
      'türkiye': 'tr',
      'turkmenistan': 'tm',
      'turksandcaicosislands': 'tc',
      'tuvalu': 'tv',
      'tv': 'tv',
      'tw': 'tw',
      'tz': 'tz',
      'ua': 'ua',
      'ug': 'ug',
      'uganda': 'ug',
      'uk': 'gb',
      'ukraine': 'ua',
      'um': 'um',
      'unionofthecomoros': 'km',
      'unitedarabemirates': 'ae',
      'unitedkingdom': 'gb',
      'unitedkingdomofgreatbritainandnorthernireland': 'gb',
      'unitedmexicanstates': 'mx',
      'unitedrepublicoftanzania': 'tz',
      'unitedstates': 'us',
      'unitedstatesminoroutlyingislands': 'um',
      'unitedstatesofamerica': 'us',
      'unitedstatesvirginislands': 'vi',
      'uruguay': 'uy',
      'us': 'us',
      'usa': 'us',
      'uy': 'uy',
      'uz': 'uz',
      'uzbekistan': 'uz',
      'va': 'va',
      'vanuatu': 'vu',
      'vatican': 'va',
      'vaticancity': 'va',
      'vaticancitystate': 'va',
      'vc': 'vc',
      've': 've',
      'venezuela': 've',
      'vg': 'vg',
      'vi': 'vi',
      'vietnam': 'vn',
      'virginislands': 'vg',
      'virginislandsoftheunitedstates': 'vi',
      'vn': 'vn',
      'vu': 'vu',
      'wallisandfutuna': 'wf',
      'westernsahara': 'eh',
      'wf': 'wf',
      'ws': 'ws',
      'xk': 'xk',
      'ye': 'ye',
      'yemen': 'ye',
      'yt': 'yt',
      'za': 'za',
      'zambia': 'zm',
      'zimbabwe': 'zw',
      'zm': 'zm',
      'zw': 'zw',
    };

    // ISO 3166-1 alpha-2 code -> ITU-T E.164 country calling code. Backs
    // phone splitting & matching for "country-code selector + national number"
    // forms. Keyed by lowercase ISO code so it composes with `countryAliases`.
    // Includes the codes covered by `countryAliases` plus common travel ones.
    var countryDialCode = {
      'ad': '376', 'ae': '971', 'af': '93', 'ag': '1', 'ai': '1', 'al': '355',
      'am': '374', 'ao': '244', 'aq': '672', 'ar': '54', 'as': '1', 'at': '43',
      'au': '61', 'aw': '297', 'ax': '358', 'az': '994', 'ba': '387',
      'bb': '1', 'bd': '880', 'be': '32', 'bf': '226', 'bg': '359', 'bh': '973',
      'bi': '257', 'bj': '229', 'bl': '590', 'bm': '1', 'bn': '673', 'bo': '591',
      'bq': '599', 'br': '55', 'bs': '1', 'bt': '975', 'bv': '47', 'bw': '267',
      'by': '375', 'bz': '501', 'ca': '1', 'cc': '61', 'cd': '243', 'cf': '236',
      'cg': '242', 'ch': '41', 'ci': '225', 'ck': '682', 'cl': '56', 'cm': '237',
      'cn': '86', 'co': '57', 'cr': '506', 'cu': '53', 'cv': '238', 'cw': '599',
      'cx': '61', 'cy': '357', 'cz': '420', 'de': '49', 'dj': '253', 'dk': '45',
      'dm': '1', 'do': '1', 'dz': '213', 'ec': '593', 'ee': '372', 'eg': '20',
      'eh': '212', 'er': '291', 'es': '34', 'et': '251', 'fi': '358', 'fj': '679',
      'fk': '500', 'fm': '691', 'fo': '298', 'fr': '33', 'ga': '241', 'gb': '44',
      'gd': '1', 'ge': '995', 'gf': '594', 'gg': '44', 'gh': '233', 'gi': '350',
      'gl': '299', 'gm': '220', 'gn': '224', 'gp': '590', 'gq': '240', 'gr': '30',
      'gs': '500', 'gt': '502', 'gu': '1', 'gw': '245', 'gy': '592', 'hk': '852',
      'hm': '61', 'hn': '504', 'hr': '385', 'ht': '509', 'hu': '36', 'id': '62',
      'ie': '353', 'il': '972', 'im': '44', 'in': '91', 'io': '246', 'iq': '964',
      'ir': '98', 'is': '354', 'it': '39', 'je': '44', 'jm': '1', 'jo': '962',
      'jp': '81', 'ke': '254', 'kg': '996', 'kh': '855', 'ki': '686', 'km': '269',
      'kn': '1', 'kp': '850', 'kr': '82', 'kw': '965', 'ky': '1', 'kz': '7',
      'la': '856', 'lb': '961', 'lc': '1', 'li': '423', 'lk': '94', 'lr': '231',
      'ls': '266', 'lt': '370', 'lu': '352', 'lv': '371', 'ly': '218', 'ma': '212',
      'mc': '377', 'md': '373', 'me': '382', 'mf': '590', 'mg': '261', 'mh': '692',
      'mk': '389', 'ml': '223', 'mm': '95', 'mn': '976', 'mo': '853', 'mp': '1',
      'mq': '596', 'mr': '222', 'ms': '1', 'mt': '356', 'mu': '230', 'mv': '960',
      'mw': '265', 'mx': '52', 'my': '60', 'mz': '258', 'na': '264', 'nc': '687',
      'ne': '227', 'nf': '672', 'ng': '234', 'ni': '505', 'nl': '31', 'no': '47',
      'np': '977', 'nr': '674', 'nu': '683', 'nz': '64', 'om': '968', 'pa': '507',
      'pe': '51', 'pf': '689', 'pg': '675', 'ph': '63', 'pk': '92', 'pl': '48',
      'pm': '508', 'pn': '64', 'pr': '1', 'ps': '970', 'pt': '351', 'pw': '680',
      'py': '595', 'qa': '974', 're': '262', 'ro': '40', 'rs': '381', 'ru': '7',
      'rw': '250', 'sa': '966', 'sb': '677', 'sc': '248', 'sd': '249', 'se': '46',
      'sg': '65', 'sh': '290', 'si': '386', 'sj': '47', 'sk': '421', 'sl': '232',
      'sm': '378', 'sn': '221', 'so': '252', 'sr': '597', 'ss': '211', 'st': '239',
      'sv': '503', 'sx': '1', 'sy': '963', 'sz': '268', 'tc': '1', 'td': '235',
      'tf': '262', 'tg': '228', 'th': '66', 'tj': '992', 'tk': '690', 'tl': '670',
      'tm': '993', 'tn': '216', 'to': '676', 'tr': '90', 'tt': '1', 'tv': '688',
      'tw': '886', 'tz': '255', 'ua': '380', 'ug': '256', 'um': '1', 'us': '1',
      'uy': '598', 'uz': '998', 'va': '39', 'vc': '1', 've': '58', 'vg': '1',
      'vi': '1', 'vn': '84', 'vu': '678', 'wf': '681', 'ws': '685', 'xk': '383',
      'ye': '967', 'yt': '262', 'za': '27', 'zm': '260', 'zw': '263'
    };

    /**
     * The E.164 country-calling-code prefixes, longest-first, used to split a
     * phone number that begins with "+". Covers every dial code in the map.
     */
    var dialPrefixes = (function () {
      var codes = [];
      for (var k in countryDialCode) {
        if (Object.prototype.hasOwnProperty.call(countryDialCode, k)) {
          codes.push(countryDialCode[k]);
        }
      }
      codes.sort(function (a, b) { return b.length - a.length; });
      return codes;
    }());

    /** Lowercase and strip spaces / _ / - (the doc's recommended step). */
    function normalize(str) {
      return String(str || '').toLowerCase().replace(/[\s_-]/g, '');
    }

    /**
     * Normalize an attribute for keyword matching: split camelCase, unify
     * separators to single spaces. Keeps tokens delimited so short keywords
     * (dr, ms, name ...) can be matched as whole tokens, not substrings.
     */
    function normalizeAttr(str) {
      return String(str || '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .replace(/[\s_-]+/g, ' ')
        .trim();
    }

    /** True if any keyword appears in fieldAttr as a delimited whole token. */
    function matchesAny(fieldAttr, keywords) {
      var n = normalizeAttr(fieldAttr);
      return keywords.some(function (k) {
        var kw = normalizeAttr(k);
        if (!kw) return false;
        // Require the keyword to appear delimited so, e.g., "Email address"
        // does not match the title keyword "dr" inside "address".
        var re = new RegExp('(^|[^a-z0-9])' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])');
        return re.test(n);
      });
    }

    /** Map an `autocomplete` attribute value to a bucket, or null. */
    function autocompleteBucket(acValue) {
      var key = String(acValue || '').toLowerCase().trim();
      return autocompleteMap[key] || null;
    }

    /**
     * Resolve a stored nationality value to an ISO 3166-1 alpha-2 code, or
     * null. Accepts codes ("US"), full names ("United States"), and common
     * aliases ("USA", "UK", ...). Keys are normalized like `countryAliases`
     * (lowercase, spaces / _ / - / ' stripped).
     */
    function countryCode(value) {
      var key = String(value || '').toLowerCase().replace(/[\s_'-]/g, '');
      if (!key) return null;
      return countryAliases[key] || null;
    }

    /**
     * Pick which <select> option's value best represents a stored value, or
     * null when nothing matches. Prefers exact matches, then the historical
     * containment match, and finally translates full country names onto
     * 2-letter option codes (see `countryCode`).
     *
     * @param {Array<{text: string, value: string}>} options option text + value
     * @param {string} value the stored profile value
     * @returns {string|null} the option value to set on the select
     */
    function matchSelectOption(options, value) {
      var v = String(value || '').toLowerCase().replace(/[\s_'-]/g, '');
      if (!v || !options || options.length === 0) return null;

      var exactValue = null;
      var exactText = null;
      var contains = null;

      for (var i = 0; i < options.length; i++) {
        var o = options[i];
        var ov = String(o.value || '').toLowerCase().replace(/[\s_'-]/g, '');
        var ot = String(o.text || '').toLowerCase().replace(/[\s_'-]/g, '');
        if (ov === v && exactValue === null) exactValue = o.value;
        if (ot === v && exactText === null) exactText = o.value;
        if (exactValue === null && exactText === null &&
            contains === null && (ot.indexOf(v) !== -1 || ov.indexOf(v) !== -1)) {
          contains = o.value;
        }
      }

      if (exactValue !== null) return exactValue;
      if (exactText !== null) return exactText;
      if (contains !== null) return contains;

      var code = countryCode(value);
      if (code) {
        for (var j = 0; j < options.length; j++) {
          if (String(options[j].value || '').toLowerCase().replace(/[\s_'-]/g, '') === code ||
              String(options[j].text || '').toLowerCase().replace(/[\s_'-]/g, '') === code) {
            return options[j].value;
          }
        }
      }

      return null;
    }

    /** Strip everything but digits from a string (e.g. a phone number). */
    function digitsOnly(str) {
      return String(str || '').replace(/\D/g, '');
    }

    /**
     * Split a stored phone number into its E.164 country calling code and the
     * national part (digits only). Returns { code, national } or, when no
     * leading country code is present, { code: null, national }.
     *
     * Supports both "+441234567890" and the national-prefix (trunk) style
     * where a country code appears without a leading "+" when it can be
     * recognised. A truly bare local number yields code: null.
     *
     * @param {string} phone
     * @returns {{code: string|null, national: string}}
     */
    function splitPhone(phone) {
      var digits = digitsOnly(phone);
      if (!digits) return { code: null, national: '' };

      var startsWithPlus = /^[^\d]*\+/.test(String(phone || '').trim());

      var code = null;
      var national = digits;

      if (startsWithPlus) {
        // Try every dial prefix, longest first.
        for (var i = 0; i < dialPrefixes.length; i++) {
          var p = dialPrefixes[i];
          if (digits.indexOf(p) === 0) {
            code = p;
            national = digits.slice(p.length);
            break;
          }
        }
        // Fall back: treat the first 1-3 digits as the code (E.164 rule).
        if (code === null) {
          var guess = digits.slice(0, 3);
          code = guess;
          national = digits.slice(3);
        }
      } else {
        // No "+": for common 1/44/7/33-style short trunk prefixes we can still
        // detect a leading code, but be conservative and return code:null so a
        // normal single phone input never loses digits.
        code = null;
        national = digits;
      }

      return { code: code, national: national };
    }

    /** Normalise an option's text/value for country-code matching. */
    function phoneOptionKey(text) {
      var s = String(text || '');
      var digits = s.replace(/\D/g, '');
      var name = String(text || '').toLowerCase().replace(/[\s_'-]/g, '');
      var sign = s.indexOf('+') !== -1;
      return { digits: digits, name: name, sign: sign, raw: s };
    }

    /**
     * Match a stored phone number against a country-code <select>'s options.
     * Returns the option value to set, or null if no option is a country
     * calling code for the stored phone.
     *
     * Handles options whose text/value use either the dialing code ("+44",
     * "44", "GB"), a full country name ("United Kingdom"), ISO codes, or a
     * mix. Reuses `countryAliases` and `countryDialCode` so a stored phone
     * ("+44 20 7946 0958") selects the right option regardless of format.
     *
     * @param {Array<{text: string, value: string}>} options
     * @param {string} phone the stored profile phone
     * @returns {string|null}
     */
    function matchPhoneCountryCode(options, phone) {
      var split = splitPhone(phone);
      if (split.code === null || !options || options.length === 0) return null;

      var code = split.code;
      // ISO code(s) that produce this dialing code, for name/flag option text.
      var isoForCode = [];
      for (var iso in countryDialCode) {
        if (Object.prototype.hasOwnProperty.call(countryDialCode, iso) &&
            countryDialCode[iso] === code) {
          isoForCode.push(iso);
        }
      }

      for (var i = 0; i < options.length; i++) {
        var o = options[i];
        var k = phoneOptionKey(o.text);
        var kv = phoneOptionKey(o.value);

        var dial = k.digits || kv.digits || '';
        // Match when the option's digits match the dialing code (with or
        // without a leading "+" / leading 0 padding beyond the code length).
        if (dial && (dial === code || dial.replace(/^0+/, '') === code)) {
          return o.value;
        }
        // Match when the option text/value is an ISO code for this dial code.
        if (isoForCode.indexOf(k.name) !== -1 || isoForCode.indexOf(kv.name) !== -1) {
          return o.value;
        }
        // Match when a full country name translates to this dial code.
        var isoFromName = countryCode(o.text) || countryCode(o.value);
        if (isoFromName && isoForCode.indexOf(isoFromName) !== -1) {
          return o.value;
        }
      }
      return null;
    }

    /**
     * Classify a field's normalized attribute text into the profile buckets it
     * matches, combining the high-priority autocomplete mapping and keywords.
     * @param {string} attrs combined attribute text to match against
     * @param {string} [autoComplete] raw autocomplete attribute value
     * @returns {string[]} matching bucket keys
     */
    function classify(attrs, autoComplete) {
      var buckets = [];
      function add(b) {
        if (b && buckets.indexOf(b) === -1) buckets.push(b);
      }

      var acBucket = autocompleteBucket(autoComplete);
      if (acBucket) add(acBucket);

      for (var key in patterns) {
        if (Object.prototype.hasOwnProperty.call(patterns, key)) {
          if (matchesAny(attrs, patterns[key])) add(key);
        }
      }

      // Doc "Recommended Matching Strategy": a bare "name" means the full
      // name, but when a field is a more specific name part (first/last/middle)
      // or a country field ("Nationality", "Country name" via country-name)
      // it must not also be claimed by the full name bucket — otherwise the
      // country dropdown would be filled with the whole full name first.
      var fullNameSuppressors = [
        'firstName', 'lastName', 'middleName',
        'nationality', 'passportIssuedCountry'
      ];
      if (buckets.indexOf('fullName') !== -1 &&
          fullNameSuppressors.some(function (b) { return buckets.indexOf(b) !== -1; })) {
        buckets.splice(buckets.indexOf('fullName'), 1);
      }

      // Structural regex rules get final say over token collisions (passport
      // sub-fields, issue-date vs issuing-country, non-person "name" fields).
      applyPatternRe(attrs, buckets);

      return buckets;
    }

    /**
     * Extract a raw embedded passenger number from an attribute string, or
     * null. Handles prefixed forms (passenger1, pax[2], traveler_3 ...) and
     * framework bracket forms (Passenger[0].FirstName).
     */
    function extractPassengerNum(attrs) {
      var a = String(attrs || '');
      var m = a.match(/(?:passengers?|travelers?|travellers?|pax|guests?|persons?|adults?)[_\-\\s]?0*(\d+)/i);
      if (m) return parseInt(m[1], 10);
      var b = a.match(/\[(\d+)\]/);
      if (b) return parseInt(b[1], 10);
      return null;
    }

    /**
     * Determine whether observed passenger numbers are 0-based or 1-based.
     * Returns the offset (0 or 1) when any numbers are seen, else null.
     */
    function detectOffset(passengerNums) {
      if (!passengerNums || passengerNums.length === 0) return null;
      return Math.min.apply(Math, passengerNums) === 0 ? 0 : 1;
    }

    /**
     * Pure: assign a list of fields to per-profile/bucket buckets.
     *
     * @param {Array<{attrs: string, autocomplete?: string}>} fields
     * @param {number} numProfiles
     * @returns {{offset: number|null, assignments: Array<Object<string, number[]>>}}
     */
    function assignFields(fields, numProfiles) {
      var assignments = [];
      for (var p = 0; p < numProfiles; p++) {
        var row = {};
        BUCKETS.forEach(function (b) { row[b] = []; });
        assignments.push(row);
      }

      var nums = [];
      fields.forEach(function (f) {
        var n = extractPassengerNum(f.attrs);
        if (n !== null) nums.push(n);
      });
      var offset = detectOffset(nums);

      fields.forEach(function (f, idx) {
        var n = extractPassengerNum(f.attrs);
        var pIndex;
        if (n !== null) {
          pIndex = offset === 0 ? n : n - 1;
        } else {
          pIndex = 0; // shared/unindexed fields go to the first passenger
        }
        if (pIndex < 0 || pIndex >= numProfiles) return;

        classify(f.attrs, f.autocomplete).forEach(function (bucket) {
          assignments[pIndex][bucket].push(idx);
        });
      });

      return { offset: offset, assignments: assignments };
    }

    return {
      BUCKETS: BUCKETS,
      patterns: patterns,
      patternRe: patternRe,
      autocompleteMap: autocompleteMap,
      countryAliases: countryAliases,
      normalize: normalize,
      normalizeAttr: normalizeAttr,
      matchesAny: matchesAny,
      autocompleteBucket: autocompleteBucket,
      applyPatternRe: applyPatternRe,
      countryCode: countryCode,
      countryDialCode: countryDialCode,
      matchSelectOption: matchSelectOption,
      digitsOnly: digitsOnly,
      splitPhone: splitPhone,
      matchPhoneCountryCode: matchPhoneCountryCode,
      classify: classify,
      extractPassengerNum: extractPassengerNum,
      detectOffset: detectOffset,
      assignFields: assignFields
    };
  }

  var matcher = buildEngine();
  // Keep the constructor exposed so callers (e.g. tests) can rebuild/embed the
  // engine if needed; the popup/content script just uses the installed matcher.
  matcher.buildEngine = buildEngine;
  return matcher;
}));
