declare module '*.svg' {
  import { FC, SVGProps } from 'react';

  const SVGComponent: FC<SVGProps<SVGSVGElement>>;
  export default SVGComponent;
}
