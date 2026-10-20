import type { BrandVariants } from '@fluentui/react-components'

/**
 * A 16-stop brand ramp, dark (10) to light (160). Fluent derives every
 * themed colour - buttons, focus rings, selected states - from these stops,
 * so this is the only place the product's colour identity is defined.
 *
 * Deliberately a cool teal: red, amber and green stay reserved for machine
 * state (fault, stale, connected). If the brand colour were amber, an
 * operator could not tell "our button" from "your data is stale".
 */
export const pendantBrand: BrandVariants = {
  10: '#001418',
  20: '#00212A',
  30: '#002D3A',
  40: '#003A4A',
  50: '#00475B',
  60: '#00556D',
  70: '#00637F',
  80: '#007192',
  90: '#0080A5',
  100: '#008FB9',
  110: '#159ECB',
  120: '#35AED7',
  130: '#5BBEE1',
  140: '#83CEEB',
  150: '#ADDDF3',
  160: '#D7EDF9',
}
