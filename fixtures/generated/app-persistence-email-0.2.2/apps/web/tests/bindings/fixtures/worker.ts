// The harness exposes bindings directly; no application route is needed.
const worker = {
  fetch() {
    return new Response(null, { status: 404 });
  },
};

export default worker;
