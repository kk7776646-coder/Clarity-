async function runTest() {
  try {
    const chatRes = await fetch("http://localhost:3000/api/conversations/conv_123/chat", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ message: "Hello, who are you? Please reply in one short sentence." })
    });
    
    if (!chatRes.ok) {
       console.error("Chat failed", await chatRes.text());
       return;
    }
    
    const decoder = new TextDecoder();
    for await (const chunk of chatRes.body) {
        const text = decoder.decode(chunk);
        console.log(text);
    }
    
  } catch (e) {
    console.error(e);
  }
}
runTest();
