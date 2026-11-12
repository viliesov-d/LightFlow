// Branded LightFlow iPhone Home Screen icon, embedded for single-worker deployment.
// Purely static: no cookies, local storage, or service worker.
const ICON_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAAGsUlEQVR42u3dPXIUZxSF4VaXchJl5A7ICCiVAsUKMIGrlKAVkMAO5MDsQCRagZSoygEQEBOoKALnXoP3gKPBo/GMZnr677vffU4EJZBa3ee959z56Tl48vTZj4YoqVqngABAlFSHJR/cyfmFK1SJ7u9uijyug1J2AGYHRDoAtpn+++ePnFKBXrx8VSwMswCwyfgMD4qpYZgUgFXjMzxtgmEqECYBgPFpXxjGBmFUABifSgdhNACWzc/4NAQIY0AwOACMT5HSYFAAmJ+ipUHL/BRFy74a6onTQRJgcTCMT1OnQd8kaJmfIqdB3yRomZ8yQ9AyP2WGoGV+ygxBy/yUGYJ2H/MTlawuPm370EZUYgqMkgCqD9VYhVrmp8wQuCsEpdZWAEx/qjkFJABJANOfsqaABCAJYPpT1hSQACQBTH/KmgISgCQAUVYdbqo/NIxef33f6//fnl46iQPq5PziwfuID7f1JprO7Lt+T1DstwesuwfpoVNTluH3+bmAGLAC0bCm//LuutfPO7t60+mYwACA2Uzf1+y7fs/HoABDNz24MZbH/7sZfwzDj5ESQPhPqzfUkgABTf/378+bX/74a+0xrYNBKqhAvcxfyqRfmH9XQDfBAAIAhDN+n/1hFYTF7wuE5ABEM/5i+i/XHyAAYDDzlzzxt1WfviBkheCQ8cuvOkOYfxsIWdOgZf7rJqvW/e5zPbstASY2fxTjDz39d02DLEnQZjB+TebvugDvmwbrzhsAVB6VSAVSeWqoPipRxQnA/ONUIgAwfwrzZ4KgZX7KDEHL/HGm/1iPAGWGoGV+1SczBC3zU2YI2povkOnvHFcNwPIEYv55IIieAm0N5o+qLuafawGu/Vq0NZhf77cPpN0BVB/nPhUAer99IC0A2d6sYTcDgOpT+AIcvQqFAUD1UYUkQGDVbH5LsOlPQVOgjWR+099CnLoCZXyVZ+kLcPRrZAcgO4Dur/pk3QUkAPNLANOf+bOmgAQgCUBlTv9ojwABIHn9UX3i1SAJwPwSgAgA6o/pn7AGSYBCzW8BBgDR6PI5wYVWnxJqVYYUKioBIvX/2nv/kOYveQ9QgZjfDkCUdQEHgOmf1vwAYH4VyAJMU0z/UhdhCWD6p6w+AGD+9OYHAPPbAZwCvR8ApPoAgFQfAJDqAwDTX/UBAPMTAJjf9AcAMT8ATH8CAPOb/gAg5geA6c/8ABhSt6eXP/98dvWG+SvT8jVdvtYAMPlNfwAQ8wPA9KfJlfLOcCVMxzEhNP2DJsAcizC48y7AdgAVTAI4BaY/AIj5AWAPoFz9XwJU0v9NfwCoPlQPAGpQHeYvvf5IAJIATkHM/q/6VA6AGhTb/BHqjwQgCVDywUkB018C6P96PwCkgGuUFIDSI1T1iX3t2mgnMmMKRDF/pO5vBwjS//V+AEgB0x8AGRfiiNVHAliI0y69Ea9RG/kER5g8tb//N2r1qWYJrrEKqT4A6BSzNUEQ1fxR62nYBPAEmWuRvgLV9tCoJ7wAUFUn7bIA6/0AsA/o/QDICEG01/jXtINVU4GiQsD8AKgSgl36P/MDQBIwPwAyQhDppla1mr9pKv6EmNvTy+b11/f/u6Bf3l0zfwfj12z+ahPgsQs3RRpEfQFcNvNXD8DiApZUiUqd/usqT4aXm6T5kLwSKlHpn9+VZeqnSoASKpHKIwGKg2CsNNjU/0ua/oyfGIBNlWjMWlSK+TelXeaXlqcFYFMazLUfMD4AqgRhzunP+ADoXYtWjfQYDKv9fw7zb1vqmR8AOxukDwxTmp/p99fBk6fPfiz+cnJ+8fML3z9/dHYeAWGdPvzzbRIAdn3olvEf6sXLV03TNM393c36BLi/u3kAAe2WCqt6e3TcnF0dD7JId32egulVoFlgWEz/t0fHvQzc95gIALPA8OHPX2f5uQSAYnT026emaT7ttT8wewFL8OoybBGmmhfgpvEBGZRcACAArGoRE4vYIKqx/kgAkgBOAQFADaKE9UcCkAR47ItSgGqe/hKAJMC2fyAFqNbp3zkBQECRzD9IAuxCEVGJ2sW3bddvJgWohurTawkGAdVg/s4AqEJUQ+/vlQCqEEXv/b0rEAgoevXpBQAIqAbz9wIABBTd/E2z4T3BXeU9xDTXwtv3gZlBAFiGAAgUxfy9K9Cm7VslogjmHzQBJAFFMv5oAACBoph/VABWIQAC7Wv8scw/OgBAoFKNPykAQKAupp/C+LMAsAkEQDD91MafFYBtIAAih9nnMn0xAHSBgepSKS+tLwYAUDA7AIgmlvsCUWr9C2tC/b2X8VvaAAAAAElFTkSuQmCC";

export const appManifest = {
  name: "LightFlow",
  short_name: "LightFlow",
  description: "Графік планових відключень електроенергії · Черкаська область · 1.1",
  lang: "uk",
  start_url: "/",
  scope: "/",
  display: "standalone",
  theme_color: "#0c1422",
  background_color: "#0c1422",
  icons: [{src: "/apple-touch-icon.png", sizes: "192x192", type: "image/png", purpose: "any maskable"}]
};
export function manifestResponse() {
  return new Response(JSON.stringify(appManifest),{
    headers: {"Content-Type":"application/manifest+json; charset=utf-8",
      "Cache-Control":"public, max-age=3600", "X-Content-Type-Options":"nosniff"}
  });
}
export function touchIconResponse() {
  const bytes=Uint8Array.from(atob(ICON_PNG_BASE64),c=>c.charCodeAt(0));
  return new Response(bytes,{
    headers: {"Content-Type":"image/png","Cache-Control":"public, max-age=86400",
      "X-Content-Type-Options":"nosniff"}
  });
}
