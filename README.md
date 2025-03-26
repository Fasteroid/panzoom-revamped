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
###### Is this the right one for me?
- Yes, this is one of the \*good\* libraries like [anvaka's](https://github.com/anvaka/panzoom) that factor touch and cursor locations into zooming.

- It'll probably work in your favorite framework out-of-the-box since it uses ✨ *no dependencies!* ✨<br>
*Just make sure to call `pz.dispose()` when you're done with one if being used with a framework!*
- It also offers kinetic behavior (on by default) to mimic the smooth scrolling mobile devices tend to implement.<br>
If the default is too slidey for you, `pz.kinetic.friction` can be changed to fit your needs.<br>

## Limitations...
###### Stuff I can't fix because browsers suck
- Currently, any descendant of a panzoom that creates a new [stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context) is prone to polluting the entire panzoom with [low-quality zooming](https://www.youtube.com/watch?v=ZrA5hD-XRgk). &nbsp;**This happens consistently on iOS Safari and its [derivatives](https://en.wikipedia.org/wiki/WebKit?useskin=vector), and due to their implementation, even scrollable elements inside the panzoom will trigger this bug.**
- iOS Safari has also forced me to adopt a gross global event listener with capturing enabled to reliably prevent scrolling the page during panzooming. &nbsp;This shouldn't break anything, but is another reason
## License

MIT License
