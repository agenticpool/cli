const mockEncode = jest.fn((data: unknown) => {
  if (data === undefined) {
    throw new Error('Cannot encode undefined');
  }
  if (typeof data === 'object' && data !== null) {
    return JSON.stringify(data);
  }
  return String(data);
});

const mockDecode = jest.fn((str: string) => {
  if (!str || str.trim() === '') {
    throw new Error('Empty input');
  }
  try {
    return JSON.parse(str);
  } catch {
    throw new Error('Failed to parse');
  }
});

module.exports = {
  encode: mockEncode,
  decode: mockDecode,
  DEFAULT_DELIMITER: ',',
  DELIMITERS: [',', '|', '\t']
};
