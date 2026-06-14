# Cover Material, Copyright, and License

Copyright 2026 Mark Watson. All rights reserved. This book may be shared using the Creative Commons "share and share alike, no modifications, no commercial reuse" license.

This eBook will be updated occasionally so please periodically check the [leanpub.com web page for this book](https://leanpub.com/typescriptai) for updates.

Please visit [my website](http://markwatson.com) and follow me on social media.

# Preface

This book is intended, dear reader, to show you a wide variety of practical AI techniques and examples using TypeScript, and to be a jumping off point when you discover things that interest you or may be useful in your work. A common theme here is covering AI programming tasks that used to be difficult or impossible but are now much simpler using modern technology. I also cover a wide variety of non-deep learning material including a chapter on Symbolic AI that has historic interest and may even have some current practical value.

This book is meant to be a quick four to five hour introduction to AI for TypeScript and JavaScript programmers. If you have experience with Large Language Models, Deep Learning, general Machine Learning and Symbolic AI then you can still enjoy this book by just spending a couple of hours experimenting with the examples.

This book is not intended as a textbook that is to be read start to finish. The parts or even chapters of this book can be read in any order. I have tried making each chapter independent and able to stand on its own even when I am building on earlier themes in the book.

{class: tip}
I try to update my books a few times a year so when purchasing on Leanpub please indicate that you want to be notified when new editions are available. Updates to new editions are free for my Leanpub books. All of my Leanpub books are free to read online.

My career developing AI applications and tools began in 1982. Until the advent of breakthroughs in deep learning around 2010 most of my development work was in Common Lisp, Java, and C++. I now work in a variety of languages including Python, TypeScript, Swift, Haskell, and Common Lisp. TypeScript is an excellent choice for AI application development: it brings strong typing to the JavaScript ecosystem, has first-class async/await support for API calls, runs on the server via Node.js, and has growing library support for machine learning and LLM integration. All examples in this book are command-line programs, with no browser or UI framework required.

Why TypeScript? TypeScript adds static type checking to JavaScript, catching errors at compile time rather than runtime. The Node.js ecosystem provides access to thousands of packages via npm, and TypeScript's type system makes complex AI code more maintainable and self-documenting. TypeScript is increasingly popular for backend services, and with the explosion of LLM APIs, it has become a practical choice for AI application development.

## About the Author

I have written over 20 books, I have over 50 US patents, and I have worked at interesting companies like Google, Capital One, SAIC, Mind AI, and others. You can read all of my recent books (including this book) for free on my Leanpub author's page [https://leanpub.com/u/markwatson](https://leanpub.com/u/markwatson). Please also visit my personal web site [https://markwatson.com](https://markwatson.com). If I had to summarize my career the short take would be that I have had a lot of fun and enjoyed my work. I hope that what you learn here will be both enjoyable and help you in your work.

If you would like to support my work please consider purchasing my books on [Leanpub](https://leanpub.com/u/markwatson) and star my git repositories that you find useful on [GitHub](https://github.com/mark-watson?tab=repositories&q=&type=public). You can also interact with me on social media on [Mastodon](https://mastodon.social/@mark_watson) and [Twitter](https://twitter.com/mark_l_watson).

## Using the Example Code

The example code that I have written for this book is Apache 2 licensed so feel free to reuse it. I also use several existing open source packages and libraries in the examples that use liberal-use licenses (I link GitHub repositories, so check the licenses for applicability in your projects). 

The examples for this book (and the entire book manuscript!) are in the GitHub repository [https://github.com/mark-watson/TypeScriptAIBook](https://github.com/mark-watson/TypeScriptAIBook). The code examples are in the directory **source-code**.

A few of the examples use APIs from Google and OpenAI. I assume that you have signed up and have access keys that should be available in the environment variables **GOOGLE_API_KEY** and **OPENAI_API_KEY**. If you don't want to sign up for these services I still hope that you enjoy reading the sample code and example output. I also cover using smaller local models using Ollama.

## NPM Security Concerns

Dear reader, I have concerns about what is often called "6pm security problems" which refers to the npm/JavaScript supply chain attacks that target automated CI/CD build windows, often occurring during late afternoon or off-hours when developer oversight is low.

The recent May 2026 "Mini Shai-Hulud" attack by TeamPCP (which compromised TanStack and Mistral AI packages within minutes) and the March 2026 Axios compromise perfectly illustrate this. Attackers look for automated gaps to push malicious payloads that steal tokens and self-propagate before teams notice at the start of the next business day.

Crucially, TypeScript itself does not introduce or exacerbate these vulnerabilities. Because TypeScript compiles down to standard JavaScript, it shares the exact same surface area as the broader Node.js/npm ecosystem. However, you can leverage specific strategies to mitigate these supply chain risks.

On my system I take the following precaution:

```
npm config set ignore-scripts true
# or for pnpm
pnpm config set ignore-scripts true
```

This may cause problems for you. If specific packages genuinely require compilation scripts (e.g., esbuild or node-gyp), explicitly allowlist only those packages using modern package managers like pnpm or yarn (via `trustedDependencies`).

## Acknowledgements

I would like to thank my wife Carol Watson who edits all of my books.

This picture shows me and my wife Carol who helps me with book production.

{width: "50%"}
![Mark and Carol Watson](MarkandCarol.jpeg)

