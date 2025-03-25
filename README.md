# panzoom-revamped
###### based on [anvaka's panzoom](https://github.com/anvaka/panzoom)

*Actually* extensible, mobile-friendly pan & zoom framework.<br>
Now with 20% less jank!

## Usage Example
```html
<style>
    .flexbox-centerer {
        box-sizing: border-box;
        overflow: hidden;

        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>

<div class="flexbox-centerer">
    <img id="cat" src="https://cataas.com/cat">
</div>

<script type="module">
    import { Panzoom } from "../dist/index.js"; // or however else you'd import in your environment
    let pz = new Panzoom( document.getElementById("cat") );
</script>
```

## But what if..?
###### Your edge case is probably covered by this library!
- By default, elements inside the panzoom can still be scrolled normally (that is, without triggering panzoom behavior)
- Mobile panzooming supports as many touch points as you can fit on the screen.
- Don't like kinetic smooth scrolling? &nbsp;There's a setting for that!
  ```ts
  pz.kinetic.friction = 1; // max friction => no more sliding!
  ```
- It'll probably work in your favorite framework out-of-the-box since it uses ✨ *no dependencies!* ✨
## License

MIT License
