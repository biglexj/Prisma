import { expect, test } from "bun:test";
import { latestTargetQuery } from "../src/features/screen_capture/model/latestTargetQuery";

const tick = () => Bun.sleep(10);

test("eventos repetidos en el mismo punto no descartan su respuesta nativa", async () => {
  const applied: number[] = [];
  let reply!: (value: number) => void;
  let calls = 0;
  const query = latestTargetQuery(() => {
    calls++;
    return new Promise<number>(resolve => { reply = resolve; });
  }, value => applied.push(value), 1);
  try {
    query.request(10, 20);
    await tick();
    for (let i = 0; i < 20; i++) query.request(10, 20);
    reply(1);
    await tick();
    expect(calls).toBe(1);
    expect(applied).toEqual([1]);
  } finally { query.cancel(); }
});

test("hit-test serializa consultas y conserva el último punto aunque el lápiz deje de moverse", async () => {
  const requests: number[] = [];
  const applied: number[] = [];
  const replies: Array<(value: number) => void> = [];
  const query = latestTargetQuery((x) => {
    requests.push(x);
    return new Promise<number>(resolve => replies.push(resolve));
  }, value => applied.push(value), 1);
  try {
    query.request(10, 20);
    await tick();
    query.request(30, 20);
    query.request(40, 20);
    expect(requests).toEqual([10]);
    replies[0](10);
    await tick();
    expect(applied).toEqual([]);
    expect(requests).toEqual([10, 40]);
    replies[1](40);
    await tick();
    expect(applied).toEqual([40]);
  } finally { query.cancel(); }
});

test("cambiar de sesión o cancelar descarta respuestas en curso y puntos en espera", async () => {
  const applied: number[] = [];
  let reply!: (value: number) => void;
  const query = latestTargetQuery(() => new Promise<number>(resolve => { reply = resolve; }), value => applied.push(value), 1);
  query.request(1, 1);
  await tick();
  query.request(2, 2);
  query.cancel();
  reply(1);
  await tick();
  expect(applied).toEqual([]);
});

test("un fallo no bloquea el siguiente hit-test", async () => {
  const applied: number[] = [];
  const query = latestTargetQuery(async x => {
    if (x === 1) throw new Error("ventana cerrada");
    return x;
  }, value => applied.push(value), 1);
  query.request(1, 1);
  await tick();
  query.request(2, 2);
  await tick();
  query.cancel();
  expect(applied).toEqual([2]);
});
