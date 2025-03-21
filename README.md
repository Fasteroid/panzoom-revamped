# panzoom-revamped
###### based on [anvaka's panzoom](https://github.com/anvaka/panzoom)

*Actually* extensible, mobile-friendly (soon) pan & zoom framework.<br>
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

## License

MIT License
