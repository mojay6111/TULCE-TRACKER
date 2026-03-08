export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { display: ['"Syne"', "sans-serif"], body: ['"DM Sans"', "sans-serif"] },
      colors: {
        tulce: { 50:"#fff8ed",100:"#ffefd3",200:"#ffdaa6",300:"#ffbe6d",400:"#ff9932",500:"#ff7a0a",600:"#f05d00",700:"#c74302",800:"#9e360b",900:"#7f2e0c" },
        dark: { 900:"#0f0e0d",800:"#1a1816",700:"#252220",600:"#302d2a",500:"#3d3936" }
      }
    }
  },
  plugins: []
};
