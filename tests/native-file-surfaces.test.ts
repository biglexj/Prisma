import { expect, test } from "bun:test";
import { intersectSurface, surfaceHoles } from "../src/shared/nativeFileSurfaceGeometry";

test("la tarjeta recortada por el scroll no cubre la cabecera ni el exterior", () => {
  expect(intersectSurface({x:-20,y:40,width:180,height:200},{x:0,y:90,width:600,height:300}))
    .toEqual({x:0,y:90,width:160,height:150});
  expect(intersectSurface({x:0,y:-150,width:100,height:100},{x:0,y:0,width:600,height:400})).toBeNull();
});

test("los controles quedan fuera de la superficie de arrastre incluso si sobresalen", () => {
  expect(surfaceHoles({x:100,y:50,width:200,height:120}, [
    {x:270,y:40,width:44,height:44}, {x:350,y:50,width:44,height:44},
  ])).toEqual([{x:170,y:0,width:30,height:34}]);
});
