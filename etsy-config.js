// The Etsy Keystring (API key) is the public half of OAuth — like an
// app's "client ID," it's meant to appear in the browser and in the
// redirect URL that sends someone to Etsy to approve access. It is NOT
// the same as the Etsy Shared Secret, which must never appear here or
// anywhere in browser code — that one only ever lives in the
// etsy-oauth-callback function's server-side secrets.
const ETSY_KEYSTRING = "2apqg1gozuc78gsia2cq52gp";
