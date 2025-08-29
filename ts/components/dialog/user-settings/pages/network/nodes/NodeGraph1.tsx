import type { NodeGraphProps } from '../NodeImage';

export const NodeGraph1 = (props: Omit<NodeGraphProps, 'pathColor'>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 153 133"
    width={props.width}
    height={props.height}
    fill="none"
    role="img"
    {...props}
  >
    <g filter="url(#NodeGraph1a)">
      <path
        fill={props.nodeColor}
        fill-rule="evenodd"
        d="M66.017 88.919c12.412 5.976 27.319.758 33.295-11.654 5.975-12.413.758-27.319-11.655-33.295s-27.318-.758-33.294 11.654c-5.976 12.413-.758 27.32 11.654 33.295m-1.78 3.698c14.454 6.96 31.814.883 38.773-13.572s.883-31.814-13.572-38.773-31.814-.883-38.774 13.572c-6.959 14.455-.883 31.814 13.572 38.773"
        clip-rule="evenodd"
      />
    </g>
    <g filter="url(#NodeGraph1b)">
      <circle
        cx="76.837"
        cy="66.445"
        r="22.144"
        fill={props.nodeColor}
        transform="rotate(25.708 76.837 66.445)"
      />
    </g>
    <defs>
      <filter
        id="NodeGraph1a"
        width="104.91"
        height="104.91"
        x="24.382"
        y="13.99"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        />
        <feMorphology
          in="SourceAlpha"
          operator="dilate"
          radius="7"
          result="effect1_dropShadow_0_1"
        />
        <feOffset />
        <feGaussianBlur stdDeviation="8.2" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.35 0" />
        <feBlend in2="BackgroundImageFix" result="effect1_dropShadow_0_1" />
        <feBlend in="SourceGraphic" in2="effect1_dropShadow_0_1" result="shape" />
      </filter>
      <filter
        id="NodeGraph1b"
        width="91.098"
        height="91.098"
        x="31.288"
        y="20.895"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        />
        <feMorphology
          in="SourceAlpha"
          operator="dilate"
          radius="7"
          result="effect1_dropShadow_0_1"
        />
        <feOffset />
        <feGaussianBlur stdDeviation="8.2" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.35 0" />
        <feBlend in2="BackgroundImageFix" result="effect1_dropShadow_0_1" />
        <feBlend in="SourceGraphic" in2="effect1_dropShadow_0_1" result="shape" />
      </filter>
    </defs>
  </svg>
);
