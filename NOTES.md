# Font compression instructions

In order to reduce network usage, this website serves only the required subset of Material icons.

Here are the required steps in order to create the subset font:

- Download all material icons as a font from fonts.google.com
- Clone the [subset-gf-icons repo from rsheeter](https://github.com/rsheeter/subset-gf-icons)
- Follow the provided instructions to convert the file `Material_Symbols_Rounded/static/MaterialSymbolsRounded-Regular.ttf`
  Here are the currently used icons:
  ```bash
  subset_gf_icons --flavor woff ./Material_Symbols_Rounded/static/MaterialSymbolsRounded-Regular.ttf draw brush arrow_selector_tool text_fields settings check delete_forever folder_open add_circle zoom_in zoom_out feedback download undo redo upload_file crop_free file_open create_new_folder chevron_left chevron_right library_books library_add
  ```
- Copy the font to the repo:
  ```bash
  cp ./Material_Symbols_Rounded/static/MaterialSymbolsRounded-Regular-subset.woff /path/to/prototuipe/site/icons.woff
  ```
- Install `sfnt2woff-zopfli`
- Run `sfnt2woff-zopfli icons.ttf` in order to make the font readable for Firefox

