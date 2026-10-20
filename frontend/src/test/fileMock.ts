/**
 * Jest cannot parse CSS or image imports, which Vite handles natively.
 * jest.config.ts maps those imports here so a component that imports an
 * asset still renders in a test.
 */
export default ''
