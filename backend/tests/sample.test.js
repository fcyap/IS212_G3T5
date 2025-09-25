// Sample test file to verify Jest setup
describe('Sample Test Suite', () => {
  test('Jest is working correctly', () => {
    expect(1 + 1).toBe(2);
  });

  test('Basic assertion tests', () => {
    expect(true).toBeTruthy();
    expect(false).toBeFalsy();
    expect('hello').toMatch(/ell/);
  });

  test('Array and object tests', () => {
    const data = { name: 'test', value: 42 };
    expect(data).toHaveProperty('name');
    expect(data.value).toBeGreaterThan(40);

    const array = [1, 2, 3];
    expect(array).toContain(2);
    expect(array).toHaveLength(3);
  });
});