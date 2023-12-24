export const Magnify = (props: { width?: number; className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.width || 30}
      height={props.width || 30}
      viewBox="0 0 490.4 490.4"
      {...props}
    >
      <path d="m484.1 454.796-110.5-110.6c29.8-36.3 47.6-82.8 47.6-133.4 0-116.3-94.3-210.6-210.6-210.6S0 94.496 0 210.796s94.3 210.6 210.6 210.6c50.8 0 97.4-18 133.8-48l110.5 110.5c12.9 11.8 25 4.2 29.2 0 8.4-8.3 8.4-20.8 0-29.1zm-443-244c0-93.6 75.9-169.5 169.5-169.5s169.6 75.9 169.6 169.5-75.9 169.5-169.5 169.5-169.6-75.9-169.6-169.5z" />
    </svg>
  );
};