const { decode } = require('./dist/datamodel/toon/index');

const rawResponse = `success:true
data:publicToken:896a7e724c50e32cb92e0a0f4c6cfa89,privateKey:1234567890`;

console.log('Decoding raw response...');
const result = decode(rawResponse);
console.log('Result:', JSON.stringify(result, null, 2));

if (result && result.data) {
  console.log('Public Token:', result.data.publicToken);
} else {
  console.log('FAILED to extract data');
}
