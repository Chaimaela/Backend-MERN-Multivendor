const formidable = require("formidable")
const { responseReturn } = require("../../utiles/response")
const cloudinary = require('cloudinary').v2
const productModel = require('../../models/productModel')

class productController{

    add_product = async (req, res) => {
        const { id } = req;
    
        // Create a formidable form instance
        const form = formidable({ multiples: true });
    
        // Parse the form data
        form.parse(req, async (err, fields, files) => {
          if (err) {
            responseReturn(res, 500, { error: "Error parsing form data" });
            return;
          }
    
          // Extract fields and files
          let {
            name,
            category,
            description,
            stock,
            price,
            discount,
            shopName,
            brand,
          } = fields;
          let { images } = files;
    
          // Check if name is provided
          name = name ? name.trim() : "";
          const slug = name.split(" ").join("-");
    
          // Configure Cloudinary
          cloudinary.config({
            cloud_name: process.env.cloud_name,
            api_key: process.env.api_key,
            api_secret: process.env.api_secret,
            secure: true,
          });
    
          try {
            // Initialize an array for uploaded image URLs
            let allImageUrl = [];
    
            // Check if images is provided
            if (images) {
              // Check if images is an array
              if (Array.isArray(images)) {
                // Upload each image in the array
                for (let i = 0; i < images.length; i++) {
                  const result = await cloudinary.uploader.upload(
                    images[i].filepath,
                    {
                      folder: "products",
                    }
                  );
                  allImageUrl.push(result.url);
                }
              } else {
                // Upload a single image file
                const result = await cloudinary.uploader.upload(images.filepath, {
                  folder: "products",
                });
                allImageUrl.push(result.url);
              }
            }
    
            // Create a new product
            await productModel.create({
              sellerId: id,
              name,
              slug,
              shopName,
              category: category.trim(),
              description: description.trim(),
              stock: parseInt(stock),
              price: parseInt(price),
              discount: parseInt(discount),
              images: allImageUrl,
              brand: brand.trim(),
            });
    
            responseReturn(res, 201, { message: "Product Added Successfully" });
          } catch (error) {
            // Handle any errors during the process
            responseReturn(res, 500, { error: error.message });
          }
        });
      };

    products_get = async (req, res) => {
        const {page,searchValue, parPage} = req.query 
        const {id} = req;

       const skipPage = parseInt(parPage) * (parseInt(page) - 1)

        try {

            if (searchValue) {
                const products = await productModel.find({
                    $text: { $search: searchValue },
                    sellerId: id
                }).skip(skipPage).limit(parPage).sort({ createdAt: -1})
                const totalProduct = await productModel.find({
                    $text: { $search: searchValue },
                    sellerId: id
                }).countDocuments()
                responseReturn(res, 200,{products,totalProduct})
            } else {
                const products = await productModel.find({ sellerId:id }).skip(skipPage).limit(parPage).sort({ createdAt: -1})
            const totalProduct = await productModel.find({ sellerId:id }).countDocuments()
            responseReturn(res, 200,{products,totalProduct}) 
            }
            
        } catch (error) {
            console.log(error.message)
        } 

    }

    // End Method 

    product_get = async (req, res) => {
        const { productId } = req.params;
        try {
            const product = await productModel.findById(productId)
            responseReturn(res, 200,{product})
        } catch (error) {
            console.log(error.message)
        }
    }
    // End Method 

    product_update = async (req, res) => {
        let {name, description, stock,price, discount,brand,productId} = req.body;
        name = name.trim()
        const slug = name.split(' ').join('-')

        try {
            await productModel.findByIdAndUpdate(productId, {
                name, description, stock,price, discount,brand,productId, slug
            })
            const product = await productModel.findById(productId)
            responseReturn(res, 200,{product, message : 'Product Updated Successfully'})
        } catch (error) {
            responseReturn(res, 500,{ error : error.message })
        }


    } 

  // End Method 

  product_image_update = async(req,res) => {
    const form = formidable({ multiples: true })

    form.parse(req, async (err, field, files) => {
        const {oldImage,productId} = field;
        const { newImage } = files

        if (err) {
            responseReturn(res, 400,{ error : err.message })
        }else{
            try {

                cloudinary.config({
                    cloud_name: process.env.cloud_name,
                    api_key: process.env.api_key,
                    api_secret: process.env.api_secret,
                    secure: true
                })

                const result = await cloudinary.uploader.upload(newImage.filepath, { folder: 'products'})

                if (result) {
                    let {images} = await productModel.findById(productId)
                    const index = images.findIndex(img => img === oldImage) 
                    images[index] = result.url;
                    await productModel.findByIdAndUpdate(productId,{images}) 

                    const product = await productModel.findById(productId)
                    responseReturn(res, 200,{product, message : 'Product Image Updated Successfully'})

                } else {
                    responseReturn(res, 404,{ error : 'Image Upload Failed'})
                }

                
            } catch (error) {
                responseReturn(res, 404,{ error : error.message })
            }
        }

 

    })
  }
  // End Method 

  delete_product = async (req, res) => {
    const { productId } = req.params;
    console.log('Received request to delete product with ID:', productId);


    try {
        const product = await productModel.findById(productId);

        if (!product) {
            responseReturn(res, 404, { error: "Product not found" });
            return;
        }

        // Configure Cloudinary
        cloudinary.config({
            cloud_name: process.env.cloud_name,
            api_key: process.env.api_key,
            api_secret: process.env.api_secret,
            secure: true,
        });

        // Delete images from Cloudinary
        const deleteImagePromises = product.images.map((url) => {
            const publicId = url.split('/').pop().split('.')[0]; // Extract the public ID
            return cloudinary.uploader.destroy(`products/${publicId}`);
        });
        await Promise.all(deleteImagePromises);

        // Delete the product from the database
        await productModel.findByIdAndDelete(productId);

        responseReturn(res, 200, { message: "Product Deleted Successfully" });
    } catch (error) {
        responseReturn(res, 500, { error: error.message });
    }
}
// End Method 


}

module.exports = new productController()